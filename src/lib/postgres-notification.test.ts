import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Db } from '../sql';
import { cleanupDb, createDb } from '../sql';
import { createLogger } from './logger';
import { PostgresNotification } from './postgres-notification';

describe('PostgresNotification', () => {
  const logger = createLogger();
  let db: Db;

  beforeAll(async () => {
    db = await createDb({ logger });
  });

  afterAll(async () => {
    await cleanupDb(logger);
  });

  beforeEach(async () => {
    // Unlisten all for a clean start
    const notification = new PostgresNotification(db);
    await notification.unlistenAll();
  });

  test('listen and unlisten accept valid channel', async () => {
    const notification = new PostgresNotification(db);
    expect(notification.listen('my_channel')).resolves.toBeUndefined();
    expect(notification.unlisten('my_channel')).resolves.toBeUndefined();
  });

  test('unlistenAll does not throw', async () => {
    const notification = new PostgresNotification(db);
    expect(notification.unlistenAll()).resolves.toBeUndefined();
  });

  test('notify works with string, number, boolean, and null payloads', async () => {
    const notification = new PostgresNotification(db);
    expect(notification.notify('test_chan', 'hello')).resolves.toBeUndefined();
    expect(notification.notify('test_chan', 1234)).resolves.toBeUndefined();
    expect(notification.notify('test_chan', true)).resolves.toBeUndefined();
    expect(notification.notify('test_chan', null)).resolves.toBeUndefined();
  });

  test('validateChannelName enforces identifier rules (invalid chars)', async () => {
    const notification = new PostgresNotification(db);
    // Channel cannot start with a number
    expect(notification.listen('123abc')).rejects.toThrow(/Invalid notification channel name/);
    // Channel cannot have spaces or dashes
    expect(notification.listen('a bc')).rejects.toThrow(/Invalid notification channel name/);
    expect(notification.listen('a-bc')).rejects.toThrow(/Invalid notification channel name/);
    // Channel cannot have special symbols
    expect(notification.listen('chan!')).rejects.toThrow(/Invalid notification channel name/);
  });

  test('notify throws on invalid channel name', async () => {
    const notification = new PostgresNotification(db);
    expect(notification.notify('bad channel', 'foo')).rejects.toThrow(
      /Invalid notification channel name/,
    );
  });
});
