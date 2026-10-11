import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests', testMatch: 'account-integration.spec.ts', workers: 1, timeout: 120_000,
  outputDir: './test-results/account',
  use: { baseURL: 'http://127.0.0.1:8097', viewport: { width: 1440, height: 960 },
    trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: [
    { command: 'node ../../node_modules/tsx/dist/cli.mjs tests/account-server.ts', url: 'http://127.0.0.1:8096/api/health', timeout: 30_000 },
    { command: 'node ../../landing/server.mjs', url: 'http://127.0.0.1:8097/health', timeout: 30_000,
      env: { PORT: '8097', WORKSPACE_URL: 'http://127.0.0.1:8096' } },
  ],
})
