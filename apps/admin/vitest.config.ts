import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@xplor/admin',
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
});
