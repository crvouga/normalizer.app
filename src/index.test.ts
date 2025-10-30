import { describe, expect, test } from 'bun:test';

describe('Server', () => {
  test('should start server and respond to health check', async () => {
    // Start server in background with custom port
    const port = 3456;

    const serverProcess = Bun.spawn(['bun', 'run', 'src/index.tsx'], {
      stdout: 'inherit',
      stderr: 'inherit',
      env: {
        ...process.env,
        PORT: port.toString(),
      },
    });

    // Wait for server to start by polling health endpoint
    let isServerUp = false;
    const startTime = Date.now();
    const timeout = 5000; // 5 second timeout

    while (!isServerUp && Date.now() - startTime < timeout) {
      try {
        const response = await fetch(`http://localhost:${port}/health`);
        if (response.ok) {
          isServerUp = true;
          break;
        }
      } catch (error) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    if (!isServerUp) {
      serverProcess.kill();
      throw new Error('Server failed to start within timeout');
    }

    try {
      // Make health check request
      const response = await fetch(`http://localhost:${port}/health`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ status: 'ok' });
    } finally {
      // Cleanup: kill server process
      serverProcess.kill();
      await serverProcess.exited;
    }
  });
});
