import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  use: {
    baseURL: 'http://localhost:5173',
    browserName: 'chromium',
  },
  webServer: {
    command: 'pnpm --filter @xplor/admin dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
});
