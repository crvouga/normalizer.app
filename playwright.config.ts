import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for e2e tests
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Look for test files in the src directory with .e2e.ts extension
  testDir: './src',
  testMatch: '**/*.e2e.ts',

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: [['html', { outputFolder: 'playwright-report' }], ['list']],

  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: 'http://localhost:5001',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Run your local dev server before starting the tests
  webServer: {
    command: 'bun run src/server.tsx',
    url: 'http://localhost:5001',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      PORT: '5001',
      DATABASE_URL:
        process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres',
      S3_ENDPOINT: process.env.S3_ENDPOINT || 'http://localhost:9000',
      S3_ACCESS_KEY: process.env.S3_ACCESS_KEY || 'minioadmin',
      S3_SECRET_KEY: process.env.S3_SECRET_KEY || 'minioadmin',
      S3_BUCKET: process.env.S3_BUCKET || 'test-bucket',
      S3_USE_SSL: process.env.S3_USE_SSL || 'false',
    },
  },
});
