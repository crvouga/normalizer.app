import { z } from 'zod';

/**
 * Discriminated union Result type for representing success (ok) or failure (err).
 * Uses `tag` as discriminator for compatibility with RemoteResult.
 */
export type Result<T, E> = { tag: 'ok'; value: T } | { tag: 'err'; error: E };

// Convenient constructors
export const Ok = <T, E = never>(value: T): Result<T, E> => ({ tag: 'ok', value });
export const Err = <T = never, E = unknown>(error: E): Result<T, E> => ({ tag: 'err', error });

/**
 * Zod schema generator for Result<T, E>
 */
export function resultSchema<T, E>(
  valueSchema: z.ZodType<T, any, any>,
  errorSchema: z.ZodType<E, any, any>,
) {
  return z.union([
    z.object({ tag: z.literal('ok'), value: valueSchema }),
    z.object({ tag: z.literal('err'), error: errorSchema }),
  ]);
}

/**
 * RemoteResult type for tracking async/remote resource states,
 * like Elm's RemoteData or rust yew's use_mut_remote_data,
 * and as a superset of Result<T, E>.
 * - 'notAsked': initial state
 * - 'loading': in progress
 * - 'ok': success (same as Result)
 * - 'err': failure (same as Result)
 */
export type RemoteResult<T, E = unknown> =
  | { tag: 'notAsked' }
  | { tag: 'loading' }
  | { tag: 'ok'; value: T }
  | { tag: 'err'; error: E };

// Convenient constructors
export const NotAsked: RemoteResult<never, never> = { tag: 'notAsked' };
export const Loading: RemoteResult<never, never> = { tag: 'loading' };
export const Success = <T, E = unknown>(value: T): RemoteResult<T, E> => ({ tag: 'ok', value });
export const Failure = <T = never, E = unknown>(error: E): RemoteResult<T, E> => ({
  tag: 'err',
  error,
});

/**
 * Zod schema generator for RemoteResult<T, E>
 */
export function remoteResultSchema<T, E>(
  valueSchema: z.ZodType<T, any, any>,
  errorSchema: z.ZodType<E, any, any>,
) {
  return z.union([
    z.object({ tag: z.literal('notAsked') }),
    z.object({ tag: z.literal('loading') }),
    z.object({ tag: z.literal('ok'), value: valueSchema }),
    z.object({ tag: z.literal('err'), error: errorSchema }),
  ]);
}
