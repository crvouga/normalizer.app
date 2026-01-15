import { useState } from 'react';
import type { RemoteResult, Result } from './result';
import { Err, Failure, Loading, NotAsked, Ok, Success } from './result';

export interface UseMutationParams<TData, TInput> {
  /**
   * Function to execute the mutation
   * @param input - The input data for the mutation
   * @returns Promise with the data to be returned in Success state
   */
  mutationFn: (input: TInput) => Promise<TData>;
  /**
   * Optional callback for when mutation starts
   */
  onStart?: (input: TInput) => void;
  /**
   * Optional callback for successful mutation
   */
  onSuccess?: (data: TData, input: TInput) => void;
  /**
   * Optional callback for failed mutation
   */
  onError?: (error: Error, input: TInput) => void;
  /**
   * Optional callback for completed mutation
   */
  onComplete?: (result: Result<TData, Error>, input: TInput) => void;
}

export interface UseMutationResult<TData, TInput> {
  /**
   * Current state of the mutation
   */
  state: RemoteResult<TData, Error>;

  /**
   * Execute the mutation with the given input
   */
  mutate: (input: TInput) => Promise<void>;

  /**
   * Whether the mutation is currently in progress
   */
  isPending: boolean;

  /**
   * Reset the mutation state to NotAsked
   */
  reset: () => void;
}

/**
 * A simple hook for executing mutations with remote state management.
 *
 * Handles:
 * - Loading state management (NotAsked, Loading, Success, Failure)
 * - Manual execution via mutate function
 * - Pending state tracking
 * - State reset capability
 * - Success and error callbacks
 * - Start callback
 *
 * @example
 * ```tsx
 * const { state, mutate, isPending } = useMutation({
 *   mutationFn: async (inputArtifactIds: ArtifactId[]) => {
 *     await trpcClient.workspace.events.append.mutate({
 *       event: { type: 'user-requested-normalization', inputArtifactIds },
 *       sessionId,
 *     });
 *   },
 *   onStart: (input) => console.log("Mutation started", input),
 *   onSuccess: () => showSuccessToast("Mutation completed!"),
 *   onError: (err) => showErrorToast("Mutation failed", err),
 * });
 *
 * <Button onClick={() => mutate(artifactIds)} loading={isPending} />
 * ```
 */
export function useMutation<TData = void, TInput = void>({
  mutationFn,
  onStart,
  onSuccess,
  onError,
  onComplete,
}: UseMutationParams<TData, TInput>): UseMutationResult<TData, TInput> {
  const [state, setState] = useState<RemoteResult<TData, Error>>(NotAsked);

  const mutate = async (input: TInput) => {
    onStart?.(input);
    setState(Loading);
    try {
      const data = await mutationFn(input);
      setState(Success(data));
      onSuccess?.(data, input);
      onComplete?.(Ok(data), input);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Mutation failed');
      setState(Failure(err));
      onError?.(err, input);
      onComplete?.(Err(err), input);
      throw error;
    }
  };

  const reset = () => {
    setState(NotAsked);
  };

  const isPending = state.tag === 'loading';

  return {
    state,
    mutate,
    isPending,
    reset,
  };
}
