import { defineConfig, devices } from '@playwright/test';
import os from 'os';
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './src',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: 0,
  workers: isCI ? 2 : Math.max(4, os.cpus().length),
  reporter: isCI ? [['github'], ['list']] : [['list']], // Use GitHub Actions reporter in CI, otherwise just list

  use: {
    baseURL: 'http://localhost:5001',
    colorScheme: 'dark',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    launchOptions: {
      headless: true,
      args: [
        '--disable-dev-shm-usage',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
      ],
      timeout: 30000,
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'bun run src/server.tsx',
    url: 'http://localhost:5001',
    reuseExistingServer: true,
    timeout: 30 * 1000,
    env: {
      PORT: '5001',
      DATABASE_URL:
        process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres',
      S3_ENDPOINT: process.env.S3_ENDPOINT || 'http://localhost:9010',
      S3_ACCESS_KEY: process.env.S3_ACCESS_KEY || 'minioadmin',
      S3_SECRET_KEY: process.env.S3_SECRET_KEY || 'minioadmin',
      S3_BUCKET: process.env.S3_BUCKET || 'test-bucket',
      S3_USE_SSL: process.env.S3_USE_SSL || 'false',
      NODE_ENV: 'test',
    },
  },
});
