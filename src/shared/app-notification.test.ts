import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Db } from '../sql';
import { cleanupDb, createDb, getPostgresConnection } from '../sql';
import { createLogger } from '../lib/logger';
import { PostgresNotification } from '../lib/postgres-notification';
import { NormalizationSessionId } from '../normalization-session/normalization-session-id';
import { AppNotification } from './app-notification';

describe('AppNotification', () => {
  const logger = createLogger();
  let db: Db;
  let sqlConnection: ReturnType<typeof getPostgresConnection>;

  beforeAll(async () => {
    db = await createDb({ logger });
    sqlConnection = getPostgresConnection();
  });

  afterAll(async () => {
    await cleanupDb(logger);
  });

  beforeEach(async () => {
    // Unlisten all for a clean start
    const notification = new PostgresNotification(db, sqlConnection ?? undefined);
    await notification.unlistenAll();
  });

  test('notify and listen - happy path for normalization_session_projection_update', async () => {
    const appNotification = new AppNotification(db);
    const sessionId = NormalizationSessionId.generate();
    const channel = 'normalization_session_projection_update';

    // Set up a promise to track when the callback is called
    let receivedPayload: string | null = null;
    let callbackCalled = false;
    const callbackPromise = new Promise<string>((resolve) => {
      const callback = (payload: string) => {
        receivedPayload = payload;
        callbackCalled = true;
        resolve(payload);
      };
      // Use PostgresNotification directly to listen with callback
      // (AppNotification.listen() doesn't provide callback functionality)
      const pgNotify = new PostgresNotification(db, sqlConnection ?? undefined);
      pgNotify.listen(channel, callback);
    });

    // Wait a bit to ensure listener is set up
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Send notification using AppNotification
    const result = await appNotification.notify({
      type: 'normalization_session_projection_update',
      payload: sessionId,
    });

    // Verify notify returns true
    expect(result).toBe(true);

    // Wait for callback to be called (with timeout)
    const received = await Promise.race([
      callbackPromise,
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('Callback not called within timeout')), 2000),
      ),
    ]);

    // Verify the callback was called with the correct payload (sessionId as string)
    expect(callbackCalled).toBe(true);
    expect(receivedPayload).not.toBeNull();
    expect(receivedPayload!).toBe(sessionId);
    expect(received).toBe(sessionId);

    // Clean up
    await appNotification.unlisten('normalization_session_projection_update');
  });
});
