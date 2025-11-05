import { z } from 'zod';

/**
 * Result type for representing success (Ok) or failure (Err).
 * This mirrors Elm/Rust's Result type: Result<T, E>
 */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

// Convenient constructors
export const Ok = <T, E = never>(value: T): Result<T, E> => ({ ok: true, value });
export const Err = <T = never, E = unknown>(error: E): Result<T, E> => ({ ok: false, error });

/**
 * Zod schema generator for Result<T, E>
 */
export function resultSchema<T, E>(
  valueSchema: z.ZodType<T, any, any>,
  errorSchema: z.ZodType<E, any, any>,
) {
  return z.union([
    z.object({ ok: z.literal(true), value: valueSchema }),
    z.object({ ok: z.literal(false), error: errorSchema }),
  ]);
}

/**
 * RemoteResult type for tracking async/remote resource states,
 * like Elm's RemoteData or rust yew's use_mut_remote_data.
 */
export type RemoteResult<T, E = unknown> =
  | { tag: 'notAsked' }
  | { tag: 'loading' }
  | { tag: 'success'; data: T }
  | { tag: 'failure'; error: E };

// Convenient constructors
export const NotAsked: RemoteResult<never, never> = { tag: 'notAsked' };
export const Loading: RemoteResult<never, never> = { tag: 'loading' };
export const Success = <T, E = unknown>(data: T): RemoteResult<T, E> => ({ tag: 'success', data });
export const Failure = <T = never, E = unknown>(error: E): RemoteResult<T, E> => ({
  tag: 'failure',
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
    z.object({ tag: z.literal('success'), data: valueSchema }),
    z.object({ tag: z.literal('failure'), error: errorSchema }),
  ]);
}
