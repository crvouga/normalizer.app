import { NormalizationSessionId } from '../normalization-session/normalization-session-id';
import type { Db, Tx } from '../sql';
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
 * Type-safe wrapper for application-level notifications using Postgres LISTEN/NOTIFY
 */
export class AppNotification {
  private readonly pgNotify: PostgresNotification;

  constructor(private readonly tx: Tx | Db) {
    this.pgNotify = new PostgresNotification(this.tx);
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
    }
  }

  /**
   * Listen for a notification channel with application-specific type safety
   *
   * @param type - Notification channel/type to listen on
   */
  async listen(type: Notification['type']): Promise<() => Promise<void>> {
    await this.pgNotify.listen(type);
    return async () => {
      await this.pgNotify.unlisten(type);
    };
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
}
