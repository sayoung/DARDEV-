import { configDefaults, type TestProjectConfiguration } from 'vitest/config';

const exclude = [...configDefaults.exclude, 'e2e/**'];

const workspace: TestProjectConfiguration[] = [
  {
    test: {
      name: '@xplor/shared',
      root: './packages/shared',
      environment: 'node',
      include: ['src/**/*.test.ts'],
      exclude: [...exclude],
    },
  },
  {
    test: {
      name: '@xplor/i18n',
      root: './packages/i18n',
      environment: 'node',
      include: ['src/**/*.test.ts'],
      exclude: [...exclude],
    },
  },
  {
    test: {
      name: '@xplor/viewer-core',
      root: './packages/viewer-core',
      environment: 'node',
      include: ['src/**/*.test.ts'],
      exclude: [...exclude],
    },
  },
  {
    test: {
      name: '@xplor/api',
      root: './apps/api',
      environment: 'node',
      include: ['src/**/*.test.ts'],
      exclude: [...exclude, '**/*.int.test.ts'],
    },
  },
  './apps/admin/vitest.config.ts',
  {
    test: {
      name: '@xplor/web',
      root: './apps/web',
      environment: 'happy-dom',
      include: ['src/**/*.test.ts'],
      exclude: [...exclude],
    },
  },
  {
    test: {
      name: '@xplor/kiosk',
      root: './apps/kiosk',
      environment: 'happy-dom',
      include: ['src/**/*.test.ts'],
      exclude: [...exclude],
    },
  },
  {
    test: {
      name: '@xplor/worker',
      root: './apps/worker',
      environment: 'node',
      include: ['src/**/*.test.ts'],
      exclude: [...exclude],
    },
  },
  {
    test: {
      name: 'scripts',
      root: './scripts',
      environment: 'node',
      include: ['**/*.spec.ts'],
      alias: {
        '@xplor/shared': '../packages/shared/src/index.ts',
      },
    },
  },
];

export default workspace;
