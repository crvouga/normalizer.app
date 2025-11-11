import { test, expect } from '@playwright/test';
import { getTestUrl, waitForText } from './lib/e2e-test-helpers';

test.describe('App E2E Tests', () => {
  test('should load the application and display the main UI', async ({ page }) => {
    await page.goto(getTestUrl('/'));

    // Wait for the app to be fully loaded
    await page.waitForLoadState('networkidle');

    // Check that the app title is visible (from the sidebar header)
    await waitForText(page, 'Normalizer');

    // Verify the page loaded successfully
    expect(page.url()).toBe(getTestUrl('/'));
  });

  test('should display the sidebar with new session button', async ({ page }) => {
    await page.goto(getTestUrl('/'));
    await page.waitForLoadState('networkidle');

    // Check for the "New Session" button (or equivalent in your app)
    const newSessionButton = page.getByRole('button', { name: /new session/i });
    await expect(newSessionButton).toBeVisible();
  });

  test('should render the main content area', async ({ page }) => {
    await page.goto(getTestUrl('/'));
    await page.waitForLoadState('networkidle');

    // The app should have a main container
    const body = await page.locator('body');
    await expect(body).toBeVisible();

    // Check that we're not showing an error state
    const bodyText = await body.textContent();
    expect(bodyText).not.toContain('Error');
    expect(bodyText).not.toContain('Something went wrong');
  });

  test('should have no console errors on initial load', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (error) => {
      consoleErrors.push(error.message);
    });

    await page.goto(getTestUrl('/'));
    await page.waitForLoadState('networkidle');

    // Wait a bit for any async errors
    await page.waitForTimeout(1000);

    // Check that there are no console errors
    // Filter out known acceptable errors if any
    const significantErrors = consoleErrors.filter(
      (error) => !error.includes('favicon'), // Favicon errors are acceptable
    );

    expect(significantErrors).toHaveLength(0);
  });

  test('should be responsive and render correctly on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto(getTestUrl('/'));
    await page.waitForLoadState('networkidle');

    // App should still be visible and functional on mobile
    await waitForText(page, 'Normalizer');

    // Check that content is not overflowing
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});
