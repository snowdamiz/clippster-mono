import { defineConfig } from '@playwright/test'
export default defineConfig({
  // Shared package sources must resolve through the standalone web install,
  // rather than each package's workspace-oriented tsconfig.
  tsconfig: './tsconfig.json',
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  testIgnore: '**/account-integration.spec.ts',
  outputDir: './test-results/standalone',
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
      command: 'tsx tests/shared-server.ts',
      url: 'http://127.0.0.1:8093',
      reuseExistingServer: false,
      timeout: 30_000
    }
  ]
})
