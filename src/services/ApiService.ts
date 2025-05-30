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
        'Accept': 'application/json',
      },
      withCredentials: false, // Disable credentials for CORS
    });

    // Add response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        console.error('API Error Details:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          config: {
            url: error.config?.url,
            method: error.config?.method,
            headers: error.config?.headers,
          }
        });

        if (error.response) {
          // Handle specific HTTP status codes
          switch (error.response.status) {
            case 401:
              throw new Error('Authentication required. Please log in again.');
            case 403:
              throw new Error('Access denied. Please check your permissions.');
            case 404:
              throw new Error('API endpoint not found. Please check the URL.');
            case 413:
              throw new Error('Image file too large. Please use a smaller image.');
            case 415:
              throw new Error('Invalid image format. Please use JPEG or PNG.');
            case 429:
              throw new Error('Too many requests. Please try again later.');
            case 500:
              throw new Error('Server error. Please try again later.');
            default:
              const errorMessage = error.response.data?.detail || error.response.data?.message || 'API request failed';
              throw new Error(errorMessage);
          }
        } else if (error.request) {
          console.error('API No Response:', error.request);
          throw new Error('No response from server. Please check your internet connection and try again.');
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

  private validateImage(file: File): void {
    // Check file size
    if (file.size > API_CONFIG.MAX_FILE_SIZE) {
      throw new Error(`Image size exceeds maximum limit of ${API_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }

    // Check file type
    if (!API_CONFIG.ALLOWED_IMAGE_TYPES.includes(file.type)) {
      throw new Error(`Invalid image type. Allowed types: ${API_CONFIG.ALLOWED_IMAGE_TYPES.join(', ')}`);
    }
  }

  private async preprocessImage(file: File): Promise<File> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      
      img.onload = () => {
        try {
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
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Could not convert canvas to blob'));
              return;
            }
            
            // Create a new file from the blob
            const resizedFile = new File([blob], 'leaf.jpg', { type: 'image/jpeg' });
            resolve(resizedFile);
          }, 'image/jpeg', 0.95);
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
    });
  }

  private async retryOperation<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= API_CONFIG.RETRY_ATTEMPTS; attempt++) {
      try {
        console.log(`Attempt ${attempt} of ${API_CONFIG.RETRY_ATTEMPTS}`);
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.error(`Attempt ${attempt} failed:`, lastError.message);
        if (attempt < API_CONFIG.RETRY_ATTEMPTS) {
          console.log(`Retrying in ${API_CONFIG.RETRY_DELAY}ms...`);
          await new Promise(resolve => setTimeout(resolve, API_CONFIG.RETRY_DELAY));
        }
      }
    }
    
    throw lastError || new Error('Operation failed after retries');
  }

  async predictDisease(imageFile: File): Promise<DiseasePrediction> {
    return this.retryOperation(async () => {
      try {
        console.log('Starting disease prediction...');
        
        // Validate image
        this.validateImage(imageFile);
        console.log('Image validation passed');

        // Preprocess image
        const resizedFile = await this.preprocessImage(imageFile);
        console.log('Image preprocessing completed');

        const formData = new FormData();
        formData.append('file', resizedFile);

        console.log('Sending request to:', API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.PREDICT);
        const response = await this.axiosInstance.post<DiseasePrediction>(
          API_CONFIG.ENDPOINTS.PREDICT,
          formData
        );

        console.log('Prediction response:', response.data);

        // Validate response
        if (!response.data.predicted_class) {
          console.warn('No predicted class in response');
          return {
            predicted_class: 'N/A',
            confidence: 0,
            top_3_predictions: {},
            all_predictions: {},
            processing_time: 0,
            warning: 'Could not determine disease class'
          };
        }

        if (response.data.confidence < API_CONFIG.MIN_CONFIDENCE) {
          console.warn('Low confidence prediction:', response.data.confidence);
          return {
            ...response.data,
            warning: 'Low confidence prediction. Please try with a clearer image.'
          };
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
        console.log('Checking API health...');
        const response = await this.axiosInstance.get(API_CONFIG.ENDPOINTS.HEALTH);
        console.log('Health check response:', response.data);
        return response.data;
      } catch (error) {
        console.error('Error checking API health:', error);
        throw error;
      }
    });
  }
}

export const apiService = ApiService.getInstance(); 