import { SQL } from 'bun';
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
 *
 * To receive notifications, provide the underlying SQL connection instance in the constructor.
 * Without it, you can still send notifications but cannot receive them.
 */
export class PostgresNotification {
  private readonly callbacks = new Map<string, Set<(payload: string) => void>>();
  private notificationHandlerSetup = false;

  constructor(
    private readonly tx: Tx | Db,
    private readonly sqlConnection?: SQL,
  ) {}

  /**
   * Start listening for PostgreSQL NOTIFY notifications on a channel
   *
   * @param channel - Notification channel name (must be a valid PostgreSQL identifier)
   * @param callback - Callback function to invoke when a notification is received on this channel
   *
   * @example
   * ```ts
   * const subscribe = new PostgresNotification(db, sqlConnection);
   * await subscribe.listen('my_channel', (payload) => {
   *   console.log('Received notification:', payload);
   * });
   * ```
   */
  async listen(channel: string, callback?: (payload: string) => void): Promise<void> {
    validateChannelName(channel);
    // Channel name is validated and safe to use as a literal identifier
    await this.tx.execute(sql.raw(`LISTEN ${channel}`));

    // If a callback is provided, store it and set up notification handler
    if (callback) {
      if (!this.sqlConnection) {
        throw new Error(
          'Cannot receive notifications: SQL connection instance is required. ' +
            'Pass the SQL instance to the constructor to enable notification callbacks.',
        );
      }

      // Store callback for this channel
      if (!this.callbacks.has(channel)) {
        this.callbacks.set(channel, new Set());
      }
      this.callbacks.get(channel)!.add(callback);

      // Set up notification handler if not already done
      if (!this.notificationHandlerSetup) {
        this.setupNotificationHandler();
        this.notificationHandlerSetup = true;
      }
    }
  }

  /**
   * Sets up the notification handler on the SQL connection
   * This is called automatically when the first callback is registered
   */
  private setupNotificationHandler(): void {
    if (!this.sqlConnection) {
      return;
    }

    // Try multiple approaches to access the underlying connection
    // Bun's SQL might expose the connection in different ways
    type EventEmitter = {
      on(event: string, handler: (msg: { channel: string; payload: string }) => void): void;
    };

    let eventEmitter: EventEmitter | null = null;

    // Approach 1: Check if SQL instance itself has an 'on' method
    if (
      typeof this.sqlConnection === 'object' &&
      this.sqlConnection !== null &&
      'on' in this.sqlConnection &&
      typeof (this.sqlConnection as Record<string, unknown>).on === 'function'
    ) {
      eventEmitter = this.sqlConnection as unknown as EventEmitter;
    }
    // Approach 2: Try accessing a nested 'connection' property
    else if (typeof this.sqlConnection === 'object' && this.sqlConnection !== null) {
      const sqlAny = this.sqlConnection as Record<string, unknown>;
      const connection = sqlAny.connection || sqlAny.client || sqlAny.pg;
      if (
        connection &&
        typeof connection === 'object' &&
        'on' in connection &&
        typeof (connection as Record<string, unknown>).on === 'function'
      ) {
        eventEmitter = connection as unknown as EventEmitter;
      }
    }

    if (eventEmitter) {
      // Set up the notification event handler
      eventEmitter.on('notification', (msg: { channel: string; payload: string }) => {
        const callbacks = this.callbacks.get(msg.channel);
        if (callbacks) {
          // Invoke all callbacks for this channel
          for (const callback of callbacks) {
            try {
              callback(msg.payload);
            } catch (error) {
              // Log error but don't break other callbacks
              console.error(`Error in notification callback for channel ${msg.channel}:`, error);
            }
          }
        }
      });
    } else {
      // If we can't set up the handler, warn the user
      console.warn(
        'PostgresNotification: Unable to set up notification handler. ' +
          'The SQL connection may not support event handlers, or the connection structure has changed. ' +
          'Notifications will be sent but not received. Consider checking Bun SQL documentation for notification support.',
      );
    }
  }

  /**
   * Stop listening for PostgreSQL NOTIFY notifications on a channel
   *
   * @param channel - Notification channel name (must be a valid PostgreSQL identifier)
   * @param callback - Optional callback to remove. If not provided, removes all callbacks for the channel.
   *
   * @example
   * ```ts
   * const subscribe = new PostgresNotification(db, sqlConnection);
   * await subscribe.unlisten('my_channel');
   * // Or remove a specific callback:
   * await subscribe.unlisten('my_channel', myCallback);
   * ```
   */
  async unlisten(channel: string, callback?: (payload: string) => void): Promise<void> {
    validateChannelName(channel);
    // Channel name is validated and safe to use as a literal identifier
    await this.tx.execute(sql.raw(`UNLISTEN ${channel}`));

    // Remove callback(s) for this channel
    if (callback) {
      const callbacks = this.callbacks.get(channel);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.callbacks.delete(channel);
        }
      }
    } else {
      // Remove all callbacks for this channel
      this.callbacks.delete(channel);
    }
  }

  /**
   * Stop listening for all PostgreSQL NOTIFY notifications
   * This also clears all registered callbacks.
   *
   * @example
   * ```ts
   * const subscribe = new PostgresNotification(db, sqlConnection);
   * await subscribe.unlistenAll();
   * ```
   */
  async unlistenAll(): Promise<void> {
    await this.tx.execute(sql`UNLISTEN *`);
    this.callbacks.clear();
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
