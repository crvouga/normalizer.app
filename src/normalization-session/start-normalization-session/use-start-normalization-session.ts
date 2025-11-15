import type { ArtifactId } from '../../artifacts/artifact-id';
import type { Result } from '../../lib/result';
import { Err, Ok } from '../../lib/result';
import { useMutation } from '../../lib/use-mutation';
import { useEntityStore } from '../../store/entity-store';
import { trpcClient } from '../../trpc-client';
import { useCurrentUserResult } from '../../users/use-current-user';
import type { NormalizationSessionId } from '../normalization-session-id';
import { NormalizationSessionId as NormalizationSessionIdGenerator } from '../normalization-session-id';
import { NormalizationSessionProjection } from '../normalization-session-projection/normalization-session-projection';

export interface StartNormalizationSessionParams {
  targetArtifactIds: ArtifactId[];
}

export interface StartNormalizationSessionResult {
  sessionId: NormalizationSessionId;
  eventId: string;
}

export function useStartNormalizationSession({
  onStartComplete,
}: {
  onStartComplete?: (result: Result<StartNormalizationSessionResult, Error>) => void;
}) {
  const entityStore = useEntityStore();
  const { currentUserResult } = useCurrentUserResult();

  const mutation = useMutation<StartNormalizationSessionResult, StartNormalizationSessionParams>({
    async mutationFn(params) {
      // Check if user is loaded
      if (currentUserResult.tag !== 'ok') {
        const error = new Error('User not loaded');
        onStartComplete?.(Err(error));
        throw error;
      }

      const sessionId = NormalizationSessionIdGenerator.generate();
      const startedAt = new Date();
      const startedByUserId = currentUserResult.value.id;

      // Create the user-started-session event
      const event = {
        type: 'user-started-session' as const,
        sessionId,
        targetArtifactIds: params.targetArtifactIds,
        startedAt,
        startedByUserId,
      };

      // Call the backend to append the event
      const output = await trpcClient.normalizationSession.events.append.mutate({
        sessionId,
        event,
      });

      // Add the event to the entity store
      entityStore.addEntity('normalizationSessionEvents', {
        id: output.eventId,
        normalization_session_id: sessionId,
        event,
        created_at: startedAt,
      });

      // Add the projection to the entity store (convert string date if needed)
      const projection = NormalizationSessionProjection.schema.parse(output.projection);
      entityStore.addEntity('normalizationSessionProjections', projection);

      const result: StartNormalizationSessionResult = { sessionId, eventId: output.eventId };
      onStartComplete?.(Ok(result));
      return result;
    },
  });

  return {
    startSession: mutation.mutate,
    state: mutation.state,
    isStarting: mutation.isPending,
  };
}
