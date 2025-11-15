import { type Page, expect } from '@playwright/test';

/**
 * E2E test helper utilities for Playwright tests
 */

/**
 * Get the base URL for e2e tests
 */
export function getTestUrl(path: string = ''): string {
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5001';
  return `${baseUrl}${path}`;
}

/**
 * Wait for the server to be ready by polling the health endpoint
 */
export async function waitForServerReady(
  options: {
    timeout?: number;
    baseUrl?: string;
  } = {},
): Promise<void> {
  const { timeout = 30000, baseUrl = getTestUrl() } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        return;
      }
    } catch (error) {
      // Server not ready yet, keep trying
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Server failed to be ready within ${timeout}ms`);
}

/**
 * Navigate to the app and wait for it to load
 */
export async function navigateToApp(page: Page): Promise<void> {
  await page.goto('/');
  // Wait for the app to be fully loaded by checking for the main container
  await page.waitForSelector('text=Normalizer', { timeout: 10000 });
}

/**
 * Check if an element is visible on the page
 */
export async function isVisible(page: Page, selector: string): Promise<boolean> {
  try {
    const element = await page.locator(selector);
    return await element.isVisible();
  } catch {
    return false;
  }
}

/**
 * Wait for text to appear on the page
 */
export async function waitForText(
  page: Page,
  text: string,
  options: { timeout?: number } = {},
): Promise<void> {
  const { timeout = 5000 } = options;
  await page.waitForSelector(`text=${text}`, { timeout });
}

/**
 * Fill a form field and wait for it to be updated
 */
export async function fillField(page: Page, selector: string, value: string): Promise<void> {
  await page.fill(selector, value);
  // Verify the field was filled
  await expect(page.locator(selector)).toHaveValue(value);
}

/**
 * Click a button and wait for navigation or action to complete
 */
export async function clickButton(
  page: Page,
  selector: string,
  options: { waitForNavigation?: boolean } = {},
): Promise<void> {
  const { waitForNavigation = false } = options;

  if (waitForNavigation) {
    await Promise.all([page.waitForNavigation({ timeout: 5000 }), page.click(selector)]);
  } else {
    await page.click(selector);
  }
}

/**
 * Take a screenshot for debugging
 */
export async function takeDebugScreenshot(page: Page, name: string): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({
    path: `test-results/${name}-${timestamp}.png`,
    fullPage: true,
  });
}

/**
 * Check if the app is in dark mode
 */
export async function isDarkMode(page: Page): Promise<boolean> {
  const html = await page.locator('html');
  const classes = await html.getAttribute('class');
  return classes?.includes('dark') || false;
}

/**
 * Wait for a network request to complete
 */
export async function waitForRequest(
  page: Page,
  urlPattern: string | RegExp,
  options: { timeout?: number } = {},
): Promise<void> {
  const { timeout = 5000 } = options;
  await page.waitForRequest(urlPattern, { timeout });
}

/**
 * Wait for a network response to complete
 */
export async function waitForResponse(
  page: Page,
  urlPattern: string | RegExp,
  options: { timeout?: number } = {},
): Promise<void> {
  const { timeout = 5000 } = options;
  await page.waitForResponse(urlPattern, { timeout });
}

/**
 * Get console logs from the page
 */
export function captureConsoleLogs(page: Page): string[] {
  const logs: string[] = [];
  page.on('console', (msg) => {
    logs.push(`[${msg.type()}] ${msg.text()}`);
  });
  return logs;
}

/**
 * Get page errors
 */
export function capturePageErrors(page: Page): Error[] {
  const errors: Error[] = [];
  page.on('pageerror', (error) => {
    errors.push(error);
  });
  return errors;
}
