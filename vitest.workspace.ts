import type { TestProjectConfiguration } from 'vitest/config';

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
    },
  },
];

export default workspace;
