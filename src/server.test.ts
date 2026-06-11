import { describe, expect, test } from 'bun:test';
import { createTestServerEnv } from './test/test-server-env';

describe('Server', () => {
  test('should start server and respond to health check', async () => {
    const port = 3456;

    const serverProcess = Bun.spawn([process.execPath, 'run', 'src/server.tsx'], {
      stdout: 'inherit',
      stderr: 'inherit',
      env: createTestServerEnv({ PORT: port.toString() }),
    });

    let isServerUp = false;
    const startTime = Date.now();
    const timeout = 8080;

    while (!isServerUp && Date.now() - startTime < timeout) {
      try {
        const response = await fetch(`http://localhost:${port}/health`);
        if (response.ok) {
          isServerUp = true;
          break;
        }
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    if (!isServerUp) {
      serverProcess.kill();
      throw new Error('Server failed to start within timeout');
    }

    try {
      const response = await fetch(`http://localhost:${port}/health`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('ok');
      expect(data.components?.db?.ok).toBe(true);
    } finally {
      serverProcess.kill();
      await serverProcess.exited;
    }
  });
});
