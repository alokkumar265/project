export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  ENDPOINTS: {
    PREDICT: '/predict',
    HEALTH: '/health'
  },
  TIMEOUT: 60000, // 60 seconds for image uploads
  IMAGE_SIZE: {
    WIDTH: 128,
    HEIGHT: 128
  },
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
  MIN_CONFIDENCE: 0.2, // 20% minimum confidence threshold
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/jpg']
}; 