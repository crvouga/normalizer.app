import { z } from 'zod';
import { PrefixedKeyValueStore } from '../../lib/key-value-store/key-value-store-prefixed';
import { PostgresKeyValueStore } from '../../lib/key-value-store/key-value-store-postgres';
import { Ok, Err, isOk, type Result } from '../../lib/result';
import { TypedKeyValueStore } from '../../lib/typed-key-value-store';
import type { Db, Tx } from '../../shared/db';

// OAuth state schema for type-safe storage
const oauthStateSchema = z.object({
  codeVerifier: z.string(),
  redirectUri: z.string(),
  sessionId: z.string().nullable(),
  expiresAt: z.number(),
});

export type OAuthState = z.infer<typeof oauthStateSchema>;

/**
 * Google OAuth state service that uses TypedKeyValueStore for persistent state storage.
 * Stores OAuth state tokens in the database instead of in-memory Map.
 * Session ID is stored in state so it can be retrieved in callback without relying on cookies (which use SameSite: Strict).
 */
export class GoogleOAuthStateService {
  private state: TypedKeyValueStore<OAuthState>;

  constructor(config: { db: Db | Tx }) {
    this.state = new TypedKeyValueStore({
      codec: oauthStateSchema,
      store: new PrefixedKeyValueStore({
        keyPrefix: ['oauth_state'],
        store: new PostgresKeyValueStore({ db: config.db }),
      }),
    });
  }

  /**
   * Store OAuth state
   */
  async setState(state: string, value: OAuthState): Promise<Result<void, string>> {
    const result = await this.state.set({ [state]: value });
    if (!isOk(result)) {
      return Err(`Failed to store OAuth state: ${result.error}`);
    }
    return Ok(undefined);
  }

  /**
   * Get OAuth state
   */
  async getState(state: string): Promise<Result<OAuthState | null, string>> {
    const result = await this.state.get([state]);
    if (!isOk(result)) {
      return Err(`Failed to get OAuth state: ${result.error}`);
    }
    const value = result.value[state];
    return Ok(value ?? null);
  }

  /**
   * Delete OAuth state
   */
  async deleteState(state: string): Promise<Result<void, string>> {
    const result = await this.state.delete([state]);
    if (!isOk(result)) {
      return Err(`Failed to delete OAuth state: ${result.error}`);
    }
    return Ok(undefined);
  }
}
