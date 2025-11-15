import { sql } from 'drizzle-orm';
import type { Db, Tx } from '../sql';

/**
 * Validates a channel name to prevent SQL injection
 * PostgreSQL channel names must be valid identifiers (letters, numbers, underscores)
 * and cannot start with a number
 */
function validateChannelName(channel: string): void {
  if (!/^[a-z_][a-z0-9_]*$/i.test(channel)) {
    throw new Error(
      `Invalid notification channel name: ${channel}. Channel names must be valid PostgreSQL identifiers.`,
    );
  }
}

/**
 * PostgreSQL LISTEN/NOTIFY subscription management
 * Provides type-safe wrappers for PostgreSQL's LISTEN, UNLISTEN, and NOTIFY commands
 */
export class PostgresNotification {
  constructor(private readonly tx: Tx | Db) {}

  /**
   * Start listening for PostgreSQL NOTIFY notifications on a channel
   *
   * @param channel - Notification channel name (must be a valid PostgreSQL identifier)
   *
   * @example
   * ```ts
   * const subscribe = new PgSubscribe(tx);
   * await subscribe.listen('my_channel');
   * ```
   */
  async listen(channel: string): Promise<void> {
    validateChannelName(channel);
    // Channel name is validated and safe to use as a literal identifier
    await this.tx.execute(sql.raw(`LISTEN ${channel}`));
  }

  /**
   * Stop listening for PostgreSQL NOTIFY notifications on a channel
   *
   * @param channel - Notification channel name (must be a valid PostgreSQL identifier)
   *
   * @example
   * ```ts
   * const subscribe = new PgSubscribe(tx);
   * await subscribe.unlisten('my_channel');
   * ```
   */
  async unlisten(channel: string): Promise<void> {
    validateChannelName(channel);
    // Channel name is validated and safe to use as a literal identifier
    await this.tx.execute(sql.raw(`UNLISTEN ${channel}`));
  }

  /**
   * Stop listening for all PostgreSQL NOTIFY notifications
   *
   * @example
   * ```ts
   * const subscribe = new PgSubscribe(tx);
   * await subscribe.unlistenAll();
   * ```
   */
  async unlistenAll(): Promise<void> {
    await this.tx.execute(sql`UNLISTEN *`);
  }

  /**
   * Send a PostgreSQL NOTIFY notification
   *
   * @param channel - Notification channel name (must be a valid PostgreSQL identifier)
   * @param payload - Notification payload (will be converted to string)
   *
   * @example
   * ```ts
   * const subscribe = new PgSubscribe(tx);
   * await subscribe.notify('my_channel', 'some-payload');
   * await subscribe.notify('user_updates', userId);
   * ```
   */
  async notify(channel: string, payload: string | number | boolean | null): Promise<void> {
    validateChannelName(channel);

    // Convert payload to string
    const payloadString = payload === null ? '' : String(payload);

    // Execute pg_notify using sql template literal
    // Channel name is validated above and safe to use as a literal string
    // Payload is automatically parameterized by drizzle's sql template
    await this.tx.execute(sql`SELECT pg_notify(${channel}::text, ${payloadString})`);
  }
}
