import type postgres from 'postgres';
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
 * To receive notifications, provide the underlying postgres connection instance in the constructor.
 * Without it, you can still send notifications but cannot receive them.
 */
export class PostgresNotification {
  private readonly callbacks = new Map<string, Set<(payload: string) => void>>();

  constructor(
    private readonly tx: Tx | Db,
    private readonly sqlConnection?: postgres.Sql,
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

    // If a callback is provided, use postgres package's built-in listen method
    if (callback) {
      if (!this.sqlConnection) {
        throw new Error(
          'Cannot receive notifications: postgres connection instance is required. ' +
            'Pass the postgres Sql instance to the constructor to enable notification callbacks.',
        );
      }

      // Store callback for this channel
      if (!this.callbacks.has(channel)) {
        this.callbacks.set(channel, new Set());
      }
      this.callbacks.get(channel)!.add(callback);

      // Use postgres package's built-in listen method
      // The callback will be called when notifications arrive
      this.sqlConnection.listen(channel, (payload: string) => {
        const callbacks = this.callbacks.get(channel);
        if (callbacks) {
          // Invoke all callbacks for this channel
          for (const cb of callbacks) {
            try {
              cb(payload);
            } catch (error) {
              // Log error but don't break other callbacks
              console.error(`Error in notification callback for channel ${channel}:`, error);
            }
          }
        }
      });
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

  /**
   * Create an async generator that yields notifications from a channel.
   * Perfect for use with tRPC subscriptions and other streaming APIs.
   *
   * The generator will automatically clean up the listener when it's closed or done.
   *
   * @param channel - Notification channel name (must be a valid PostgreSQL identifier)
   * @returns Async generator that yields notification payloads as strings
   *
   * @example
   * ```ts
   * // In a tRPC subscription
   * .subscription(async function* ({ input, ctx }) {
   *   const notification = new PostgresNotification(ctx.db, sqlConnection);
   *   for await (const payload of notification.subscribe('my_channel')) {
   *     yield { data: payload };
   *   }
   * })
   * ```
   *
   * @example
   * ```ts
   * // Direct usage
   * const notification = new PostgresNotification(db, sqlConnection);
   * const generator = notification.subscribe('user_updates');
   * for await (const payload of generator) {
   *   console.log('Received:', payload);
   * }
   * ```
   */
  async *subscribe(channel: string): AsyncGenerator<string, void, unknown> {
    if (!this.sqlConnection) {
      throw new Error(
        'Cannot receive notifications: postgres connection instance is required. ' +
          'Pass the postgres Sql instance to the constructor to enable notification subscriptions.',
      );
    }

    validateChannelName(channel);

    // Buffer to hold notifications that arrive before we're ready
    const notificationBuffer: string[] = [];
    // Queue to hold pending notification resolvers
    const queue: Array<{ resolve: (value: string) => void; reject: (error: Error) => void }> = [];
    let isActive = true;

    // Callback that will be invoked when notifications arrive
    const callback = (payload: string) => {
      if (!isActive) {
        return;
      }

      // If there's a waiting promise, resolve it with the payload
      const next = queue.shift();
      if (next) {
        next.resolve(payload);
      } else {
        // No waiting promise, buffer the notification for later
        notificationBuffer.push(payload);
      }
    };

    try {
      // Set up the listener
      await this.listen(channel, callback);

      // Generator loop: yield notifications as they arrive
      while (isActive) {
        // Check if we have a buffered notification first
        const buffered = notificationBuffer.shift();
        if (buffered) {
          yield buffered;
          continue;
        }

        // Create a promise that will be resolved when a notification arrives
        const promise = new Promise<string>((resolve, reject) => {
          // Check if we're still active before adding to queue
          if (!isActive) {
            reject(new Error('Subscription closed'));
            return;
          }
          queue.push({ resolve, reject });
        });

        try {
          // Wait for the next notification
          const payload = await promise;
          // Check again after promise resolves (in case we were closed while waiting)
          if (!isActive) {
            break;
          }
          yield payload;
        } catch (err) {
          // If the subscription was closed, break the loop
          if (err instanceof Error && err.message === 'Subscription closed') {
            break;
          }
          // Re-throw other errors
          throw err;
        }
      }
    } finally {
      // Cleanup: stop accepting new notifications and unlisten
      isActive = false;

      // Clear the notification buffer
      notificationBuffer.length = 0;

      // Reject any pending promises
      for (const { reject } of queue) {
        reject(new Error('Subscription closed'));
      }
      queue.length = 0;

      // Remove the callback and unlisten
      await this.unlisten(channel, callback);
    }
  }
}
