import { useState } from 'react';
import type { RemoteResult } from './result';
import { NotAsked, Loading, Success, Failure } from './result';

export interface UseMutationParams<TData, TInput> {
  /**
   * Function to execute the mutation
   * @param input - The input data for the mutation
   * @returns Promise with the data to be returned in Success state
   */
  mutationFn: (input: TInput) => Promise<TData>;
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
 *
 * @example
 * ```tsx
 * const { state, mutate, isPending } = useMutation({
 *   mutationFn: async (inputArtifactIds: ArtifactId[]) => {
 *     await trpcClient.normalizationSession.events.append.mutate({
 *       event: { type: 'user-requested-normalization', inputArtifactIds },
 *       sessionId,
 *     });
 *   },
 * });
 *
 * <Button onClick={() => mutate(artifactIds)} loading={isPending} />
 * ```
 */
export function useMutation<TData = void, TInput = void>({
  mutationFn,
}: UseMutationParams<TData, TInput>): UseMutationResult<TData, TInput> {
  const [state, setState] = useState<RemoteResult<TData, Error>>(NotAsked);

  const mutate = async (input: TInput) => {
    setState(Loading);

    try {
      const data = await mutationFn(input);
      setState(Success(data));
    } catch (error) {
      setState(Failure(error instanceof Error ? error : new Error('Mutation failed')));
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
