import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, '**/*.int.test.ts', 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: [
        'apps/api/src/auth/**/*.ts',
        'apps/api/src/users/**/*.ts',
        'apps/api/src/catalog/publication-rules.ts',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
        'apps/api/src/users/**': {
          lines: 70,
          functions: 70,
          branches: 70,
          statements: 70,
        },
        'apps/api/src/auth/access-policy.ts': {
          lines: 100,
          functions: 100,
          branches: 100,
          statements: 100,
        },
        'apps/api/src/catalog/publication-rules.ts': {
          lines: 100,
          functions: 100,
          branches: 100,
          statements: 100,
        },
      },
    },
  },
});
