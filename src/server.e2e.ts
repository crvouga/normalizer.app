import { test, expect } from '@playwright/test';
import { getTestUrl } from './lib/e2e-test-helpers';

test.describe('Server E2E Tests', () => {
  test('should respond to health check endpoint', async ({ request }) => {
    const response = await request.get(getTestUrl('/health'));

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toEqual({ status: 'ok' });
  });

  test('should serve the main application page', async ({ page }) => {
    await page.goto(getTestUrl('/'));

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Check that we got a successful response
    expect(page.url()).toBe(getTestUrl('/'));

    // Check that the page has some content (not a 404 or error page)
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
    expect(body!.length).toBeGreaterThan(0);
  });

  test('should handle 404 for non-existent routes gracefully', async ({ request }) => {
    const response = await request.get(getTestUrl('/this-route-does-not-exist'));

    // Server should handle this gracefully (either 404 or redirect to main page)
    expect([200, 404]).toContain(response.status());
  });
});
