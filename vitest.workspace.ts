import { configDefaults, type TestProjectConfiguration } from 'vitest/config';

const workspace: TestProjectConfiguration[] = [
  {
    test: {
      name: '@xplor/shared',
      root: './packages/shared',
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  },
  {
    test: {
      name: '@xplor/i18n',
      root: './packages/i18n',
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  },
  {
    test: {
      name: '@xplor/api',
      root: './apps/api',
      environment: 'node',
      include: ['src/**/*.test.ts'],
      exclude: [...configDefaults.exclude, '**/*.int.test.ts'],
    },
  },
  './apps/admin/vitest.config.ts',
  {
    test: {
      name: '@xplor/web',
      root: './apps/web',
      environment: 'happy-dom',
      include: ['src/**/*.test.ts'],
    },
  },
  {
    test: {
      name: '@xplor/kiosk',
      root: './apps/kiosk',
      environment: 'happy-dom',
      include: ['src/**/*.test.ts'],
    },
  },
  {
    test: {
      name: '@xplor/worker',
      root: './apps/worker',
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  },
];

export default workspace;
