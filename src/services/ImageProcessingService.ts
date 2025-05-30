import { createWorker } from 'tesseract.js';
import { CameraResultType } from '@capacitor/camera';

interface CalibrationData {
  referenceArea: number;  // in cm²
  referencePixels: number;
  pixelToCmRatio: number;
}

interface MeasurementResult {
  leafArea: number;
  greenPixelCount: number;
  redPixelCount: number;
  calibrationArea: number;
  pixelToCmRatio: number;
}

interface AnalysisResult {
  leafArea: number;
  greenPixelCount: number;
  redPixelCount: number;
  calibrationArea: number;
  pixelToCmRatio: number;
  // New metrics
  leafPerimeter: number;
  leafWidth: number;
  leafHeight: number;
  leafAspectRatio: number;
  leafCompactness: number;
  leafColorMetrics: {
    averageGreen: number;
    averageRed: number;
    averageBlue: number;
    colorVariance: number;
  };
  leafHealthIndicators: {
    colorUniformity: number;
    edgeRegularity: number;
    textureComplexity: number;
  };
}

export class ImageProcessingService {
  private calibrationData: CalibrationData | null = null;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private processedImageCache: Map<string, ImageData> = new Map();
  private calibrationArea: number = 0;
  private pixelToCmRatio: number = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
  }

  async setCalibration(area: number, imageUrl: string): Promise<void> {
    this.calibrationArea = area;
    const redPixels = await this.countRedPixels(imageUrl);
    this.pixelToCmRatio = area / redPixels;
  }

  async measureLeafArea(imageUrl: string): Promise<AnalysisResult> {
    const img = new Image();
    img.src = imageUrl;

    return new Promise((resolve, reject) => {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        let greenPixels = 0;
        let redPixels = 0;
        let totalGreen = 0;
        let totalRed = 0;
        let totalBlue = 0;
        let greenVariance = 0;
        let edgePixels = 0;
        let texturePixels = 0;

        // First pass: count pixels and calculate color averages
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          if (this.isGreen(r, g, b)) {
            greenPixels++;
            totalGreen += g;
            totalRed += r;
            totalBlue += b;
          } else if (this.isRed(r, g, b)) {
            redPixels++;
          }
        }

        // Calculate averages
        const avgGreen = totalGreen / greenPixels;
        const avgRed = totalRed / greenPixels;
        const avgBlue = totalBlue / greenPixels;

        // Second pass: calculate variance and detect edges
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          if (this.isGreen(r, g, b)) {
            // Calculate color variance
            const greenDiff = g - avgGreen;
            greenVariance += greenDiff * greenDiff;

            // Detect edges
            if (this.isEdgePixel(data, i, canvas.width)) {
              edgePixels++;
            }

            // Detect texture
            if (this.isTexturePixel(data, i, canvas.width)) {
              texturePixels++;
            }
          }
        }

        // Calculate final metrics
        // Use correct formula: Leaf Area = Green Pixels × (Calibration Area ÷ Red Pixels)
        let leafArea = 0;
        if (redPixels > 0) {
          leafArea = greenPixels * (this.calibrationArea / redPixels);
        } else {
          leafArea = 0; // Avoid division by zero
        }
        const colorVariance = greenVariance / greenPixels;
        const edgeRegularity = edgePixels / greenPixels;
        const textureComplexity = texturePixels / greenPixels;

        // Calculate leaf dimensions
        const { width, height, perimeter } = this.calculateLeafDimensions(data, canvas.width, canvas.height);
        const aspectRatio = width / height;
        
        // Fix compactness calculation
        const compactness = (4 * Math.PI * leafArea) / (perimeter * perimeter);
        const normalizedCompactness = Math.min(1, Math.max(0, compactness));

        // Calculate health indicators with improved normalization
        const colorUniformity = Math.max(0, Math.min(1, 1 - (colorVariance / (255 * 255))));
        const normalizedEdgeRegularity = Math.max(0, Math.min(1, edgeRegularity));
        const normalizedTextureComplexity = Math.max(0, Math.min(1, textureComplexity));

        resolve({
          leafArea,
          greenPixelCount: greenPixels,
          redPixelCount: redPixels,
          calibrationArea: this.calibrationArea,
          pixelToCmRatio: this.pixelToCmRatio,
          leafPerimeter: perimeter,
          leafWidth: width,
          leafHeight: height,
          leafAspectRatio: aspectRatio,
          leafCompactness: normalizedCompactness,
          leafColorMetrics: {
            averageGreen: avgGreen,
            averageRed: avgRed,
            averageBlue: avgBlue,
            colorVariance: colorVariance
          },
          leafHealthIndicators: {
            colorUniformity: colorUniformity,
            edgeRegularity: normalizedEdgeRegularity,
            textureComplexity: normalizedTextureComplexity
          }
        });
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
    });
  }

  private calculateLeafDimensions(data: Uint8ClampedArray, width: number, height: number): { width: number; height: number; perimeter: number } {
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;
    let perimeter = 0;
    let edgePoints = new Set<string>();

    // First pass: find leaf boundaries
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (this.isGreen(data[i], data[i + 1], data[i + 2])) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }

    // Second pass: calculate perimeter using edge detection
    const visited = new Set<string>();
    const queue: [number, number][] = [];
    
    // Find a starting point on the edge
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const i = (y * width + x) * 4;
        if (this.isGreen(data[i], data[i + 1], data[i + 2])) {
          queue.push([x, y]);
          break;
        }
      }
      if (queue.length > 0) break;
    }

    // Use flood fill to find the perimeter
    while (queue.length > 0) {
      const [x, y] = queue.shift()!;
      const key = `${x},${y}`;
      
      if (visited.has(key)) continue;
      visited.add(key);

      const neighbors = [
        [-1, -1], [0, -1], [1, -1],
        [-1, 0],           [1, 0],
        [-1, 1],  [0, 1],  [1, 1]
      ];

      let isEdge = false;
      for (const [dx, dy] of neighbors) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const ni = (ny * width + nx) * 4;
          if (!this.isGreen(data[ni], data[ni + 1], data[ni + 2])) {
            isEdge = true;
            // Calculate distance for this edge point
            const distance = Math.sqrt(dx * dx + dy * dy);
            perimeter += distance;
          } else if (!visited.has(`${nx},${ny}`)) {
            queue.push([nx, ny]);
          }
        }
      }

      if (isEdge) {
        edgePoints.add(key);
      }
    }

    // Calculate dimensions in pixels first
    const pixelWidth = maxX - minX;
    const pixelHeight = maxY - minY;
    const pixelPerimeter = perimeter;

    // Convert to real-world measurements using the pixel-to-cm ratio
    // Use square root of pixel-to-cm ratio for linear measurements
    const linearRatio = Math.sqrt(this.pixelToCmRatio);
    
    return {
      width: pixelWidth * linearRatio,
      height: pixelHeight * linearRatio,
      perimeter: pixelPerimeter * linearRatio
    };
  }

  private isGreen(r: number, g: number, b: number): boolean {
    // Enhanced green detection using HSL-like color space
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    
    // Calculate hue-like value
    let hue = 0;
    if (delta === 0) {
      hue = 0;
    } else if (max === g) {
      hue = 60 * (((b - r) / delta) + 2);
    }
    
    // Check if pixel is green using both hue and saturation
    const saturation = max === 0 ? 0 : delta / max;
    const lightness = (max + min) / 2;
    
    return hue >= 80 && hue <= 160 && 
           saturation > 0.2 && 
           lightness > 0.2 && 
           g > Math.max(r, b) * 1.2;
  }

  private isRed(r: number, g: number, b: number): boolean {
    // Enhanced red detection using HSL-like color space
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    
    // Calculate hue-like value
    let hue = 0;
    if (delta === 0) {
      hue = 0;
    } else if (max === r) {
      hue = 60 * (((g - b) / delta) % 6);
    }
    
    // Check if pixel is red using both hue and saturation
    const saturation = max === 0 ? 0 : delta / max;
    return (hue >= 340 || hue <= 20) && saturation > 0.2 && r > 50;
  }

  private isEdgePixel(data: Uint8ClampedArray, index: number, width: number): boolean {
    const neighbors = [
      [-1, -1], [0, -1], [1, -1],
      [-1, 0],           [1, 0],
      [-1, 1],  [0, 1],  [1, 1]
    ];

    const x = (index / 4) % width;
    const y = Math.floor((index / 4) / width);

    return neighbors.some(([dx, dy]) => {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= Math.floor(data.length / (4 * width))) {
        return true;
      }
      const ni = (ny * width + nx) * 4;
      return !this.isGreen(data[ni], data[ni + 1], data[ni + 2]);
    });
  }

  private isTexturePixel(data: Uint8ClampedArray, index: number, width: number): boolean {
    const neighbors = [
      [-1, -1], [0, -1], [1, -1],
      [-1, 0],           [1, 0],
      [-1, 1],  [0, 1],  [1, 1]
    ];

    const x = (index / 4) % width;
    const y = Math.floor((index / 4) / width);
    const centerG = data[index + 1];

    let textureCount = 0;
    for (const [dx, dy] of neighbors) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < Math.floor(data.length / (4 * width))) {
        const ni = (ny * width + nx) * 4;
        const neighborG = data[ni + 1];
        if (Math.abs(centerG - neighborG) > 30) {
          textureCount++;
        }
      }
    }

    return textureCount >= 3; // Consider it a texture pixel if at least 3 neighbors have significant difference
  }

  private async countRedPixels(imageUrl: string): Promise<number> {
    const img = new Image();
    img.src = imageUrl;

    return new Promise((resolve, reject) => {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        let redPixels = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          if (this.isRed(r, g, b)) {
            redPixels++;
          }
        }

        resolve(redPixels);
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
    });
  }

  getCalibrationData(): CalibrationData | null {
    return this.calibrationData;
  }

  clearCache(): void {
    this.processedImageCache.clear();
  }
}

export const imageProcessingService = new ImageProcessingService();