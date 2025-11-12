# E2E Testing Guide

This project uses Playwright for end-to-end (e2e) testing, running alongside Bun's built-in test runner for unit tests.

## Test Organization

### File Naming Convention

- **Unit Tests**: Use `.test.ts` or `.test.tsx` extension
  - Example: `server.test.ts`, `http-cookie.test.ts`
  - Run with: `bun test`
  - Located next to the code they test

- **E2E Tests**: Use `.e2e.ts` extension
  - Example: `server.e2e.ts`, `app.e2e.ts`
  - Run with: `bun run e2e`
  - Located next to the code they test

This naming convention ensures complete isolation between the two test runners.

## Running Tests

### Unit Tests Only

```bash
bun test
```

### E2E Tests Only

```bash
bun run e2e
```

### E2E Tests with UI Mode (for debugging)

```bash
bun run e2e:ui
```

### E2E Tests in Debug Mode

```bash
bun run e2e:debug
```

## Writing E2E Tests

E2E tests are colocated with the code they test and use the `.e2e.ts` extension.

### Example E2E Test

```typescript
import { test, expect } from '@playwright/test';
import { getTestUrl, waitForText } from './lib/e2e-test-helpers';

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    await page.goto(getTestUrl('/'));
    await waitForText(page, 'Expected Text');

    const button = page.getByRole('button', { name: /click me/i });
    await expect(button).toBeVisible();
  });
});
```

### Available Test Helpers

The `src/lib/e2e-test-helpers.ts` file provides useful utilities:

- `getTestUrl(path)` - Get the full URL for a test path
- `waitForServerReady()` - Wait for the server to be ready
- `navigateToApp(page)` - Navigate to the app and wait for it to load
- `isVisible(page, selector)` - Check if an element is visible
- `waitForText(page, text)` - Wait for text to appear
- `fillField(page, selector, value)` - Fill a form field
- `clickButton(page, selector)` - Click a button
- And more...

## Configuration

### Playwright Configuration

The `playwright.config.ts` file configures:

- Test pattern matching (`**/*.e2e.ts`)
- Base URL (`http://localhost:5001`)
- Test timeout and retry policies
- Browser configurations
- Automatic server startup

### Bun Test Configuration

The `bunfig.toml` file ensures Bun's test runner only picks up `.test.ts` files, not `.e2e.ts` files.

## CI/CD Integration

E2E tests run automatically in the GitHub Actions pipeline:

1. **On every push to main**
2. **After unit tests pass**
3. **Before production migrations**

The pipeline:

- Starts PostgreSQL and MinIO services
- Runs database migrations
- Installs Playwright browsers
- Runs all e2e tests
- Uploads test reports as artifacts on failure

## Local Development Setup

### Prerequisites

1. Ensure Docker is running (for PostgreSQL and MinIO):

   ```bash
   bun run docker:up
   ```

2. Run database migrations:

   ```bash
   bun run db:migrate
   ```

3. Playwright browsers are automatically downloaded when you run e2e tests for the first time

### Running Tests During Development

For the best development experience:

1. Start the development server in one terminal:

   ```bash
   bun run server
   ```

2. Run e2e tests in watch mode in another terminal:
   ```bash
   bun run e2e:ui
   ```

The UI mode allows you to:

- See tests run in real-time
- Debug failing tests
- Time-travel through test steps
- View traces and screenshots

## Test Reports

- Test results are displayed in the terminal
- HTML reports are generated in `playwright-report/`
- View the HTML report: `npx playwright show-report`
- Test artifacts (screenshots, traces) are saved in `test-results/`

## Best Practices

1. **Colocation**: Keep tests next to the code they test
2. **Isolation**: Each test should be independent
3. **Descriptive Names**: Use clear test names that describe the behavior
4. **Page Object Pattern**: Consider extracting common page interactions into helper functions
5. **Wait Strategies**: Use Playwright's auto-waiting features instead of hard timeouts
6. **Selectors**: Prefer user-facing selectors (roles, labels) over CSS selectors

## Troubleshooting

### Tests fail locally but pass in CI

- Ensure your local environment matches CI (Docker services running)
- Check that you're using the same Node/Bun version
- Clear browser cache: `bunx playwright cache clean`

### Tests are flaky

- Increase timeouts in `playwright.config.ts`
- Use more robust wait strategies
- Check for race conditions in your app

### Server won't start

- Check if port 5001 is available: `lsof -i :5001`
- Kill any processes using the port: `kill -9 <PID>`
- Ensure database and S3 services are running

## Additional Resources

- [Playwright Documentation](https://playwright.dev)
- [Bun Test Documentation](https://bun.sh/docs/cli/test)
