
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';

export interface ImageData {
  path: string;
  webPath: string;
  format: string;
}

export class CameraService {
  async captureImage(): Promise<ImageData | null> {
    try {
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera
      });
      
      if (photo && photo.webPath) {
        return {
          path: photo.path || '',
          webPath: photo.webPath,
          format: photo.format || 'jpeg'
        };
      }
      return null;
    } catch (error) {
      console.error('Error capturing image:', error);
      throw error;
    }
  }

  async selectImage(): Promise<ImageData | null> {
    try {
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Photos
      });
      
      if (photo && photo.webPath) {
        return {
          path: photo.path || '',
          webPath: photo.webPath,
          format: photo.format || 'jpeg'
        };
      }
      return null;
    } catch (error) {
      console.error('Error selecting image:', error);
      throw error;
    }
  }
}

export const cameraService = new CameraService();
