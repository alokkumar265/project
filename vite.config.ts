import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "localhost",
    port: 8080,
    strictPort: true,
    cors: true,
    headers: {
      'Service-Worker-Allowed': '/',
    },
    proxy: {
      '/predict': {
        target: process.env.VITE_API_URL || 'http://localhost:8000',
        changeOrigin: true,
        // Allow POST file upload
        secure: false,
      },
      '/health': {
        target: process.env.VITE_API_URL || 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['axios', 'react', 'react-dom'],
        },
      },
    },
  },
  // Fix worker plugins warning
  worker: {
    format: 'es',
    plugins: () => [],
  },
  // Ensure no service worker registration
  define: {
    'process.env.NODE_ENV': JSON.stringify(mode),
    'process.env.VITE_DISABLE_SW': 'true',
  },
  // Configure public directory
  publicDir: 'public',
}));
