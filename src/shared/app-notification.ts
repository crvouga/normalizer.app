import { NormalizationSessionId } from '../normalization-session/normalization-session-id';
import type { Db, Tx } from './sql';
import { getPostgresConnection } from './sql';
import { PostgresNotification } from '../lib/postgres-notification';

/**
 * Application-specific notification types with type-safe payloads
 * Discriminated union for type-safe notification handling
 */
export type Notification = {
  type: 'normalization_session_projection_update';
  payload: NormalizationSessionId;
};

/**
 * Helper function for exhaustive checking in switch statements
 */
function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${value}`);
}

/**
 * Type-safe wrapper for application-level notifications using Postgres LISTEN/NOTIFY
 */
export class AppNotification {
  private readonly pgNotify: PostgresNotification;

  constructor(private readonly tx: Tx | Db) {
    // Pass the postgres connection if available (for Db instances, not transactions)
    const sqlConnection = getPostgresConnection();
    this.pgNotify = new PostgresNotification(this.tx, sqlConnection ?? undefined);
  }

  /**
   * Parse a string payload into a typed notification payload based on the notification type.
   * This centralizes the parsing logic used by both listen and subscribe methods.
   *
   * @param type - Notification type
   * @param payload - Raw string payload from PostgreSQL
   * @returns Typed payload value
   */
  private parsePayload<T extends Notification['type']>(
    type: T,
    payload: string,
  ): Extract<Notification, { type: T }>['payload'] {
    switch (type) {
      case 'normalization_session_projection_update': {
        const parsed = NormalizationSessionId.schema.parse(payload);
        return parsed as Extract<Notification, { type: T }>['payload'];
      }
      default: {
        // Exhaustive check: ensures all notification types are handled
        assertNever(type as never);
      }
    }
  }

  /**
   * Send an application-specific notification.
   *
   * @param notification - Application-specific notification object
   * @returns Promise<true> when sent
   */
  async notify(notification: Notification): Promise<true> {
    switch (notification.type) {
      case 'normalization_session_projection_update': {
        await this.pgNotify.notify('normalization_session_projection_update', notification.payload);
        return true;
      }
      default: {
        // Exhaustive check: ensures all notification types are handled
        return assertNever(notification.type);
      }
    }
  }

  /**
   * Listen for a notification channel with application-specific type safety
   *
   * @param type - Notification channel/type to listen on
   * @param callback - Optional callback function that receives typed notification payloads
   * @returns Promise that resolves to an unsubscribe function when callback is provided, or void when no callback
   *
   * @example
   * ```ts
   * const appNotification = new AppNotification(db);
   * const unsubscribe = await appNotification.listen('normalization_session_projection_update', (sessionId) => {
   *   // sessionId is typed as NormalizationSessionId
   *   console.log('Session updated:', sessionId);
   * });
   * // Later, to stop listening:
   * await unsubscribe();
   * ```
   */
  async listen<T extends Notification['type']>(
    type: T,
    callback?: (payload: Extract<Notification, { type: T }>['payload']) => void,
  ): Promise<void | (() => Promise<void>)> {
    if (callback) {
      // Create a wrapper callback that parses and types the payload
      const wrappedCallback = (payload: string) => {
        const parsed = this.parsePayload(type, payload);
        callback(parsed);
      };

      await this.pgNotify.listen(type, wrappedCallback);
      return async () => {
        await this.pgNotify.unlisten(type, wrappedCallback);
      };
    } else {
      await this.pgNotify.listen(type);
    }
  }

  /**
   * Unlisten for a notification channel with application-specific type safety
   *
   * @param type - Notification channel/type to unlisten from
   */
  async unlisten(type: Notification['type']): Promise<void> {
    await this.pgNotify.unlisten(type);
  }

  /**
   * Unlisten from all channels
   */
  async unlistenAll(): Promise<void> {
    await this.pgNotify.unlistenAll();
  }

  /**
   * Create an async generator that yields notifications from a channel.
   * Perfect for use with tRPC subscriptions and other streaming APIs.
   *
   * The generator will automatically clean up the listener when it's closed or done.
   * Returns type-safe payloads based on the notification type.
   *
   * @param type - Notification type to subscribe to
   * @returns Async generator that yields typed notification payloads
   *
   * @example
   * ```ts
   * // In a tRPC subscription
   * .subscription(async function* ({ input, ctx }) {
   *   const appNotification = new AppNotification(ctx.db);
   *   for await (const sessionId of appNotification.subscribe('normalization_session_projection_update')) {
   *     // sessionId is typed as NormalizationSessionId
   *     yield { sessionId };
   *   }
   * })
   * ```
   *
   * @example
   * ```ts
   * // Direct usage
   * const appNotification = new AppNotification(db);
   * for await (const sessionId of appNotification.subscribe('normalization_session_projection_update')) {
   *   console.log('Session updated:', sessionId);
   * }
   * ```
   */
  async *subscribe<T extends Notification['type']>(
    type: T,
  ): AsyncGenerator<Extract<Notification, { type: T }>['payload'], void, unknown> {
    // Get the underlying generator from PostgresNotification
    const generator = this.pgNotify.subscribe(type);

    // Yield typed payloads based on notification type
    for await (const payload of generator) {
      // Parse the payload string into the typed value based on notification type
      // The payload comes as a string from PostgreSQL
      const parsed = this.parsePayload(type, payload);
      yield parsed;
    }
  }
}
