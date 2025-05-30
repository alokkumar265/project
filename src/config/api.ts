export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || 'https://plant-disease-backend-f3gr.onrender.com',
  ENDPOINTS: {
    PREDICT: '/predict',
    HEALTH: '/health'
  },
  TIMEOUT: 30000, // 30 seconds
  IMAGE_SIZE: {
    WIDTH: 128,
    HEIGHT: 128
  }
}; 