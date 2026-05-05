import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  // In production, VITE_API_URL is injected by Netlify environment variables
  define: {
    __API_URL__: JSON.stringify(process.env.VITE_API_URL || ''),
  },
});
