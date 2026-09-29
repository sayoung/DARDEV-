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
];

export default workspace;
