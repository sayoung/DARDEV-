import { configDefaults, type TestProjectConfiguration } from 'vitest/config';
import { resolve } from 'node:path';

const exclude = [...configDefaults.exclude, 'e2e/**'];

const workspace: TestProjectConfiguration[] = [
  {
    test: {
      name: '@xplor/shared',
      root: resolve(__dirname, './packages/shared'),
      environment: 'node',
      include: ['src/**/*.test.ts'],
      exclude: [...exclude],
    },
  },
  {
    test: {
      name: '@xplor/i18n',
      root: resolve(__dirname, './packages/i18n'),
      environment: 'node',
      include: ['src/**/*.test.ts'],
      exclude: [...exclude],
    },
  },
  {
    test: {
      name: '@xplor/viewer-core',
      root: resolve(__dirname, './packages/viewer-core'),
      environment: 'node',
      include: ['src/**/*.test.ts'],
      exclude: [...exclude],
    },
  },
  {
    test: {
      name: '@xplor/api',
      root: resolve(__dirname, './apps/api'),
      environment: 'node',
      include: ['src/**/*.test.ts'],
      exclude: [...exclude, '**/*.int.test.ts'],
    },
  },
  resolve(__dirname, './apps/admin/vitest.config.ts'),
  {
    test: {
      name: '@xplor/web',
      root: resolve(__dirname, './apps/web'),
      environment: 'happy-dom',
      include: ['src/**/*.test.ts'],
      exclude: [...exclude],
    },
  },
  {
    test: {
      name: '@xplor/kiosk',
      root: resolve(__dirname, './apps/kiosk'),
      environment: 'happy-dom',
      include: ['src/**/*.test.ts'],
      exclude: [...exclude],
    },
  },
  {
    test: {
      name: '@xplor/worker',
      root: resolve(__dirname, './apps/worker'),
      environment: 'node',
      include: ['src/**/*.test.ts'],
      exclude: [...exclude],
    },
  },
  {
    test: {
      name: 'scripts',
      root: resolve(__dirname, './scripts'),
      environment: 'node',
      include: ['**/*.spec.ts'],
      alias: {
        '@xplor/shared': resolve(__dirname, './packages/shared/src/index.ts'),
      },
    },
  },
];

export default workspace;
