import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  workers: 1,
  timeout: 120_000,
  use: {
    actionTimeout: 10_000,
    baseURL: 'http://127.0.0.1:8091',
    viewport: { width: 1440, height: 960 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: [
    {
      command: 'tsx tests/browser-server.ts',
      url: 'http://127.0.0.1:8091/api/health',
      reuseExistingServer: false,
      timeout: 30_000
    },
    {
      command: 'tsx tests/shared-server.ts',
      url: 'http://127.0.0.1:8093',
      reuseExistingServer: false,
      timeout: 30_000
    }
  ]
})
