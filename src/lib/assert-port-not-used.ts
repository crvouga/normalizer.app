import type { Logger } from './logger';

type AssertPortNotUsedParams = {
  port: number;
  logger: Logger;
};

/**
 * Asserts that a port is not already in use by attempting to bind to it.
 * Throws an error with helpful debugging information if the port is in use.
 */
export async function assertPortNotUsed({ port, logger }: AssertPortNotUsedParams): Promise<void> {
  try {
    // Try to create a temporary server to check if the port is available
    const testServer = Bun.serve({
      port,
      fetch() {
        return new Response('test');
      },
    });

    // If successful, immediately stop the test server
    testServer.stop();
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EADDRINUSE') {
      logger.error(
        `Port ${port} is already in use. Please stop the existing server or use a different port (set PORT environment variable).`,
      );
      logger.error(
        `To find and kill the process using port ${port}, run: lsof -ti:${port} | xargs kill -9`,
      );
    } else {
      logger.error('Failed to check port availability:', error as Record<string, unknown>);
    }
    throw error;
  }
}
