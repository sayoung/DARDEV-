import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: 'http://localhost:5173',
    browserName: 'chromium',
  },
  webServer: [
    ...(process.env.CI ? [] : [{
      command: 'pnpm --filter @xplor/api dev',
      url: 'http://127.0.0.1:3000/api/health',
      reuseExistingServer: true,
      timeout: 120000,
    }]),
    {
      command: 'pnpm --filter @xplor/admin dev',
      port: 5173,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm --filter @xplor/web dev',
      url: 'http://127.0.0.1:5174',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
});
