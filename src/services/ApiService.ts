import axios, { AxiosError } from 'axios';
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
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          console.error('API Error Response:', error.response.data);
          throw new Error(error.response.data.detail || 'API request failed');
        } else if (error.request) {
          // The request was made but no response was received
          console.error('API No Response:', error.request);
          throw new Error('No response from server. Please check your internet connection.');
        } else {
          // Something happened in setting up the request that triggered an Error
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

  async predictDisease(imageFile: File): Promise<DiseasePrediction> {
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
      
      // Convert to blob
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

      return response.data;
    } catch (error) {
      console.error('Error predicting disease:', error);
      throw error;
    }
  }

  async checkHealth(): Promise<any> {
    try {
      const response = await this.axiosInstance.get(API_CONFIG.ENDPOINTS.HEALTH);
      return response.data;
    } catch (error) {
      console.error('Error checking API health:', error);
      throw error;
    }
  }
}

export const apiService = ApiService.getInstance(); 