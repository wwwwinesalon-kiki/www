import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 180000,
  expect: { timeout: 30000 },
  use: {
    // NextURL normalizes loopback IPs to localhost; keep the browser Origin
    // identical so the real same-origin write guard is exercised unchanged.
    baseURL: 'http://localhost:3100',
    headless: true,
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node tests/support/review-server.mjs',
    url: 'http://localhost:3100/member/login',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
