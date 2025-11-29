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

export function isOk<T, E>(result: Result<T, E>): result is { tag: 'ok'; value: T } {
  return result.tag === 'ok';
}

export function isErr<T, E>(result: Result<T, E>): result is { tag: 'err'; error: E } {
  return result.tag === 'err';
}

export function isNotAsked<T, E>(result: RemoteResult<T, E>): result is { tag: 'notAsked' } {
  return result.tag === 'notAsked';
}

export function isLoading<T, E>(result: RemoteResult<T, E>): result is { tag: 'loading' } {
  return result.tag === 'loading';
}

/**
 * Executes a function and returns its result wrapped in a Result object.
 * If the function throws, the error is caught and returned as an Err.
 *
 * @template T - The type of the successful result.
 * @template E - The type of the error (default: unknown).
 * @param fn - The function to execute.
 * @returns {Result<T, E>} An Ok containing the function's return value,
 *          or an Err containing the caught error if an exception occurs.
 */
export function tryCatch<T, E = unknown>(fn: () => T): Result<T, E> {
  try {
    return Ok(fn());
  } catch (error) {
    return Err(error as E);
  }
}

/**
 * Executes an async function and returns its result wrapped in a Result object.
 * If the function throws or rejects, the error is caught and returned as an Err.
 *
 * @template T - The type of the successful result.
 * @template E - The type of the error (default: unknown).
 * @param fn - The async function to execute.
 * @returns {Promise<Result<T, E>>} A promise that resolves to an Ok containing the function's return value,
 *          or an Err containing the caught error if an exception or rejection occurs.
 */
export async function tryCatchAsync<T, E = unknown>(fn: () => Promise<T>): Promise<Result<T, E>> {
  try {
    const value = await fn();
    return Ok(value);
  } catch (error) {
    return Err(error as E);
  }
}

/**
 * Unsafely unwraps the value from a Result. Returns the value if Ok, throws if Err.
 *
 * @param result The Result to unwrap.
 * @returns The value inside Ok.
 * @throws The error inside Err if result is an Err.
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.tag === 'ok') {
    return result.value;
  } else {
    throw result.error;
  }
}

/**
 * Combines an array of Result<T, E> into a single Result<T[], E> until the first Err.
 * If all results are Ok, returns Ok with an array of values.
 * If any result is an Err, returns the first Err encountered.
 *
 * @param results Array of Result<T, E>.
 * @returns Result<T[], E>
 */
export function combineUntilError<T, E>(results: Result<T, E>[]): Result<T[], E> {
  const values: T[] = [];
  for (const result of results) {
    if (result.tag === 'err') {
      return result;
    }
    values.push(result.value);
  }
  return Ok(values);
}
