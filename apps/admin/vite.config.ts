import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const port = 5173;

export default defineConfig({
  plugins: [react()],
  server: {
    port,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  preview: {
    port,
    strictPort: true,
  },
});
