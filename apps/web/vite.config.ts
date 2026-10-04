import { defineConfig } from 'vite';

const port = 5174;

export default defineConfig({
  server: {
    port,
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:3000'
    }
  },
  preview: {
    port,
    strictPort: true,
  },
});
