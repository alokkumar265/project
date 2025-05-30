export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || 'https://plant-disease-backend-f3gr.onrender.com',
  ENDPOINTS: {
    PREDICT: '/predict',
    HEALTH: '/health'
  },
  TIMEOUT: 60000, // 60 seconds for image upload
  IMAGE_SIZE: {
    WIDTH: 224, // Updated to match model input size
    HEIGHT: 224
  },
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
  MIN_CONFIDENCE: 0.2 // 20% minimum confidence threshold
}; 