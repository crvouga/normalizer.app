import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Db } from './sql';
import { cleanupDb, createDb, getPostgresConnection } from './sql';
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

  test('notify returns true', async () => {
    const appNotification = new AppNotification(db);
    const sessionId = NormalizationSessionId.generate();

    const result = await appNotification.notify({
      type: 'normalization_session_projection_update',
      payload: sessionId,
    });

    expect(result).toBe(true);
  });

  test('listen callback API - receives typed notification payload', async () => {
    const appNotification = new AppNotification(db);
    const sessionId = NormalizationSessionId.generate();

    // Set up a promise to track when the callback is called
    let receivedPayload: NormalizationSessionId | null = null;
    let callbackCalled = false;
    const callbackPromise = new Promise<NormalizationSessionId>((resolve) => {
      const callback = (payload: NormalizationSessionId) => {
        receivedPayload = payload;
        callbackCalled = true;
        resolve(payload);
      };
      appNotification.listen('normalization_session_projection_update', callback);
    });

    // Wait a bit to ensure listener is set up
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Send notification using AppNotification
    await appNotification.notify({
      type: 'normalization_session_projection_update',
      payload: sessionId,
    });

    // Wait for callback to be called (with timeout)
    const received = await Promise.race([
      callbackPromise,
      new Promise<NormalizationSessionId>((_, reject) =>
        setTimeout(() => reject(new Error('Callback not called within timeout')), 2000),
      ),
    ]);

    // Verify the callback was called with the correct typed payload
    expect(callbackCalled).toBe(true);
    expect(receivedPayload).not.toBeNull();
    expect(receivedPayload!).toBe(sessionId);
    expect(received).toBe(sessionId);
  });

  test('listen callback API - unsubscribe function works', async () => {
    const appNotification = new AppNotification(db);
    const sessionId = NormalizationSessionId.generate();

    let callbackCalled = false;
    const callback = (_payload: NormalizationSessionId) => {
      callbackCalled = true;
    };

    // Set up listener with callback
    const unsubscribe = await appNotification.listen(
      'normalization_session_projection_update',
      callback,
    );
    expect(unsubscribe).toBeDefined();
    expect(typeof unsubscribe).toBe('function');

    // Wait a bit to ensure listener is set up
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Unsubscribe
    await unsubscribe!();

    // Send notification - callback should not be called
    await appNotification.notify({
      type: 'normalization_session_projection_update',
      payload: sessionId,
    });

    // Wait a bit to ensure notification was processed
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Verify callback was not called
    expect(callbackCalled).toBe(false);
  });

  test('subscribe generator API - yields typed notification payloads', async () => {
    const appNotification = new AppNotification(db);
    const sessionId = NormalizationSessionId.generate();

    // Set up generator
    const generator = appNotification.subscribe('normalization_session_projection_update');

    // Start consuming immediately
    const firstNextPromise = generator.next();

    // Wait a bit to ensure listener is set up
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Send notification
    await appNotification.notify({
      type: 'normalization_session_projection_update',
      payload: sessionId,
    });

    // Get the first value from the generator (with timeout)
    const firstResult = await Promise.race([
      firstNextPromise,
      new Promise<IteratorResult<NormalizationSessionId, void>>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout waiting for first notification')), 2000),
      ),
    ]);
    expect(firstResult.done).toBe(false);
    expect(firstResult.value).toBe(sessionId);

    // Start waiting for the second notification
    const secondNextPromise = generator.next();

    // Send another notification
    const sessionId2 = NormalizationSessionId.generate();
    await appNotification.notify({
      type: 'normalization_session_projection_update',
      payload: sessionId2,
    });

    // Get the second value (with timeout)
    const secondResult = await Promise.race([
      secondNextPromise,
      new Promise<IteratorResult<NormalizationSessionId, void>>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout waiting for second notification')), 2000),
      ),
    ]);
    expect(secondResult.done).toBe(false);
    expect(secondResult.value).toBe(sessionId2);

    // Close the generator (cleanup happens automatically)
    await generator.return(undefined);
  });

  test('subscribe generator API - works with for await loop', async () => {
    const appNotification = new AppNotification(db);
    const sessionIds = [
      NormalizationSessionId.generate(),
      NormalizationSessionId.generate(),
      NormalizationSessionId.generate(),
    ];
    const receivedPayloads: NormalizationSessionId[] = [];

    // Start the generator
    const generator = appNotification.subscribe('normalization_session_projection_update');

    // Wait a bit to ensure listener is set up
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Start consuming in the background
    const consumePromise = (async () => {
      for await (const payload of generator) {
        receivedPayloads.push(payload);
        if (receivedPayloads.length === sessionIds.length) {
          break;
        }
      }
    })();

    // Send notifications
    for (const sessionId of sessionIds) {
      await appNotification.notify({
        type: 'normalization_session_projection_update',
        payload: sessionId,
      });
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // Wait for all to be received
    await Promise.race([
      consumePromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout waiting for notifications')), 3000),
      ),
    ]);

    // Verify all notifications were received
    expect(receivedPayloads).toEqual(sessionIds);
  });

  test('listen callback API - multiple notifications received in order', async () => {
    const appNotification = new AppNotification(db);
    const sessionIds = [
      NormalizationSessionId.generate(),
      NormalizationSessionId.generate(),
      NormalizationSessionId.generate(),
    ];
    const receivedPayloads: NormalizationSessionId[] = [];

    // Set up listener
    const allReceivedPromise = new Promise<NormalizationSessionId[]>((resolve) => {
      const callback = (payload: NormalizationSessionId) => {
        receivedPayloads.push(payload);
        if (receivedPayloads.length === sessionIds.length) {
          resolve(receivedPayloads);
        }
      };
      appNotification.listen('normalization_session_projection_update', callback);
    });

    // Wait a bit to ensure listener is set up
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Send multiple notifications
    for (const sessionId of sessionIds) {
      await appNotification.notify({
        type: 'normalization_session_projection_update',
        payload: sessionId,
      });
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // Wait for all notifications to be received
    const received = await Promise.race([
      allReceivedPromise,
      new Promise<NormalizationSessionId[]>((_, reject) =>
        setTimeout(() => reject(new Error('Not all callbacks called within timeout')), 3000),
      ),
    ]);

    // Verify all notifications were received in order
    expect(received).toEqual(sessionIds);
    expect(receivedPayloads).toEqual(sessionIds);

    // Clean up
    await appNotification.unlisten('normalization_session_projection_update');
  });
});
