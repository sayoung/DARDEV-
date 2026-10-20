import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@xplor/api',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: [...configDefaults.exclude, '**/*.int.test.ts', 'e2e/**'],
  },
});
