import { defineConfig } from 'vite';

const port = 5174;

export default defineConfig({
  server: {
    port,
    strictPort: true,
  },
  preview: {
    port,
    strictPort: true,
  },
});
