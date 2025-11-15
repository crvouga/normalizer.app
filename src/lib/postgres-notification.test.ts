import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Db } from '../shared/sql';
import { cleanupDb, createDb, getPostgresConnection } from '../shared/sql';
import { createLogger } from './logger';
import { PostgresNotification } from './postgres-notification';

describe('PostgresNotification', () => {
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

  test('listen and unlisten accept valid channel', async () => {
    const notification = new PostgresNotification(db, sqlConnection ?? undefined);
    expect(notification.listen('my_channel')).resolves.toBeUndefined();
    expect(notification.unlisten('my_channel')).resolves.toBeUndefined();
  });

  test('unlistenAll does not throw', async () => {
    const notification = new PostgresNotification(db, sqlConnection ?? undefined);
    expect(notification.unlistenAll()).resolves.toBeUndefined();
  });

  test('notify works with string, number, boolean, and null payloads', async () => {
    const notification = new PostgresNotification(db, sqlConnection ?? undefined);
    expect(notification.notify('test_chan', 'hello')).resolves.toBeUndefined();
    expect(notification.notify('test_chan', 1234)).resolves.toBeUndefined();
    expect(notification.notify('test_chan', true)).resolves.toBeUndefined();
    expect(notification.notify('test_chan', null)).resolves.toBeUndefined();
  });

  test('validateChannelName enforces identifier rules (invalid chars)', async () => {
    const notification = new PostgresNotification(db, sqlConnection ?? undefined);
    // Channel cannot start with a number
    expect(notification.listen('123abc')).rejects.toThrow(/Invalid notification channel name/);
    // Channel cannot have spaces or dashes
    expect(notification.listen('a bc')).rejects.toThrow(/Invalid notification channel name/);
    expect(notification.listen('a-bc')).rejects.toThrow(/Invalid notification channel name/);
    // Channel cannot have special symbols
    expect(notification.listen('chan!')).rejects.toThrow(/Invalid notification channel name/);
  });

  test('notify throws on invalid channel name', async () => {
    const notification = new PostgresNotification(db, sqlConnection ?? undefined);
    expect(notification.notify('bad channel', 'foo')).rejects.toThrow(
      /Invalid notification channel name/,
    );
  });

  test('notify/listen behavior - callback receives notification', async () => {
    const notification = new PostgresNotification(db, sqlConnection ?? undefined);
    const channel = 'test_notify_channel';
    const testPayload = 'test-payload-123';

    // Set up a promise to track when the callback is called
    let receivedPayload: string | null = null;
    let callbackCalled = false;
    const callbackPromise = new Promise<string>((resolve) => {
      const callback = (payload: string) => {
        receivedPayload = payload;
        callbackCalled = true;
        resolve(payload);
      };
      // Start listening with callback
      notification.listen(channel, callback);
    });

    // Wait a bit to ensure listener is set up
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Send notification
    await notification.notify(channel, testPayload);

    // Wait for callback to be called (with timeout)
    const received = await Promise.race([
      callbackPromise,
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('Callback not called within timeout')), 2000),
      ),
    ]);

    // Verify the callback was called with the correct payload
    expect(callbackCalled).toBe(true);
    expect(receivedPayload).not.toBeNull();
    expect(receivedPayload!).toBe(testPayload);
    expect(received).toBe(testPayload);

    // Clean up
    await notification.unlisten(channel);
  });

  test('notify/listen behavior - multiple notifications received in order', async () => {
    const notification = new PostgresNotification(db, sqlConnection ?? undefined);
    const channel = 'test_multi_channel';
    const payloads = ['first', 'second', 'third'];
    const receivedPayloads: string[] = [];

    // Set up listener
    const allReceivedPromise = new Promise<string[]>((resolve) => {
      const callback = (payload: string) => {
        receivedPayloads.push(payload);
        if (receivedPayloads.length === payloads.length) {
          resolve(receivedPayloads);
        }
      };
      notification.listen(channel, callback);
    });

    // Wait a bit to ensure listener is set up
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Send multiple notifications
    for (const payload of payloads) {
      await notification.notify(channel, payload);
      // Small delay to ensure ordering
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // Wait for all notifications to be received
    const received = await Promise.race([
      allReceivedPromise,
      new Promise<string[]>((_, reject) =>
        setTimeout(() => reject(new Error('Not all callbacks called within timeout')), 3000),
      ),
    ]);

    // Verify all notifications were received in order
    expect(received).toEqual(payloads);
    expect(receivedPayloads).toEqual(payloads);

    // Clean up
    await notification.unlisten(channel);
  });

  test('notify/listen behavior - different payload types are received correctly', async () => {
    const notification = new PostgresNotification(db, sqlConnection ?? undefined);
    const channel = 'test_types_channel';
    const testCases = [
      { payload: 'string-value', expected: 'string-value' },
      { payload: 12345, expected: '12345' },
      { payload: true, expected: 'true' },
      { payload: false, expected: 'false' },
      { payload: null, expected: '' },
    ];

    for (const testCase of testCases) {
      let receivedPayload: string | null = null;
      const callbackPromise = new Promise<string>((resolve) => {
        const callback = (payload: string) => {
          receivedPayload = payload;
          resolve(payload);
        };
        notification.listen(channel, callback);
      });

      // Wait a bit to ensure listener is set up
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Send notification
      await notification.notify(channel, testCase.payload);

      // Wait for callback
      const received = await Promise.race([
        callbackPromise,
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('Callback not called within timeout')), 2000),
        ),
      ]);

      // Verify the payload was received correctly
      expect(received).toBe(testCase.expected);
      expect(receivedPayload).not.toBeNull();
      expect(receivedPayload!).toBe(testCase.expected);

      // Clean up before next test case
      await notification.unlisten(channel);
    }
  });

  test('subscribe generator API - yields notifications as they arrive', async () => {
    const notification = new PostgresNotification(db, sqlConnection ?? undefined);
    const channel = 'test_generator_channel';
    const testPayload = 'generator-payload-123';

    // Set up generator
    const generator = notification.subscribe(channel);

    // Start consuming immediately (this ensures the generator is active)
    const firstNextPromise = generator.next();

    // Wait a bit to ensure listener is set up
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Send notification
    await notification.notify(channel, testPayload);

    // Get the first value from the generator (with timeout)
    const firstResult = await Promise.race([
      firstNextPromise,
      new Promise<IteratorResult<string, void>>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout waiting for first notification')), 2000),
      ),
    ]);
    expect(firstResult.done).toBe(false);
    expect(firstResult.value).toBe(testPayload);

    // Start waiting for the second notification
    const secondNextPromise = generator.next();

    // Send another notification
    const testPayload2 = 'generator-payload-456';
    await notification.notify(channel, testPayload2);

    // Get the second value (with timeout)
    const secondResult = await Promise.race([
      secondNextPromise,
      new Promise<IteratorResult<string, void>>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout waiting for second notification')), 2000),
      ),
    ]);
    expect(secondResult.done).toBe(false);
    expect(secondResult.value).toBe(testPayload2);

    // Close the generator (cleanup happens automatically)
    await generator.return(undefined);
  });

  test('subscribe generator API - works with for await loop', async () => {
    const notification = new PostgresNotification(db, sqlConnection ?? undefined);
    const channel = 'test_for_await_channel';
    const payloads = ['first', 'second', 'third'];
    const receivedPayloads: string[] = [];

    // Start the generator
    const generator = notification.subscribe(channel);

    // Wait a bit to ensure listener is set up
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Start consuming in the background
    const consumePromise = (async () => {
      for await (const payload of generator) {
        receivedPayloads.push(payload);
        if (receivedPayloads.length === payloads.length) {
          break;
        }
      }
    })();

    // Send notifications
    for (const payload of payloads) {
      await notification.notify(channel, payload);
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
    expect(receivedPayloads).toEqual(payloads);
  });
});
