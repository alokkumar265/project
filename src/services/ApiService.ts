import axios from 'axios';
import type { AxiosError } from 'axios';
import { API_CONFIG } from '@/config/api';

export interface DiseasePrediction {
  predicted_class: string;
  confidence: number;
  top_3_predictions: Record<string, number>;
  all_predictions: Record<string, number>;
  processing_time: number;
  warning?: string;
}

export class ApiService {
  private static instance: ApiService;
  private axiosInstance;

  private constructor() {
    this.axiosInstance = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: API_CONFIG.TIMEOUT,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    // Add response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response) {
          console.error('API Error Response:', error.response.data);
          throw new Error(error.response.data.detail || 'API request failed');
        } else if (error.request) {
          console.error('API No Response:', error.request);
          throw new Error('No response from server. Please check your internet connection.');
        } else {
          console.error('API Request Error:', error.message);
          throw new Error('Failed to make request. Please try again.');
        }
      }
    );
  }

  public static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  private async retryOperation<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= API_CONFIG.RETRY_ATTEMPTS; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        if (attempt < API_CONFIG.RETRY_ATTEMPTS) {
          await new Promise(resolve => setTimeout(resolve, API_CONFIG.RETRY_DELAY));
        }
      }
    }
    
    throw lastError || new Error('Operation failed after retries');
  }

  async predictDisease(imageFile: File): Promise<DiseasePrediction> {
    return this.retryOperation(async () => {
      try {
        // Create a canvas to resize the image
        const img = new Image();
        img.src = URL.createObjectURL(imageFile);
        
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });

        const canvas = document.createElement('canvas');
        canvas.width = API_CONFIG.IMAGE_SIZE.WIDTH;
        canvas.height = API_CONFIG.IMAGE_SIZE.HEIGHT;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          throw new Error('Could not get canvas context');
        }

        // Draw and resize the image
        ctx.drawImage(img, 0, 0, API_CONFIG.IMAGE_SIZE.WIDTH, API_CONFIG.IMAGE_SIZE.HEIGHT);
        
        // Convert to blob with high quality
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Could not convert canvas to blob'));
          }, 'image/jpeg', 0.95);
        });

        // Create a new file from the blob
        const resizedFile = new File([blob], 'leaf.jpg', { type: 'image/jpeg' });

        const formData = new FormData();
        formData.append('file', resizedFile);

        const response = await this.axiosInstance.post<DiseasePrediction>(
          API_CONFIG.ENDPOINTS.PREDICT,
          formData
        );

        // Validate response
        if (!response.data.predicted_class || response.data.confidence < API_CONFIG.MIN_CONFIDENCE) {
          throw new Error('Low confidence prediction. Please try with a clearer image.');
        }

        return response.data;
      } catch (error) {
        console.error('Error predicting disease:', error);
        throw error;
      }
    });
  }

  async checkHealth(): Promise<any> {
    return this.retryOperation(async () => {
      try {
        const response = await this.axiosInstance.get(API_CONFIG.ENDPOINTS.HEALTH);
        return response.data;
      } catch (error) {
        console.error('Error checking API health:', error);
        throw error;
      }
    });
  }
}

export const apiService = ApiService.getInstance(); 