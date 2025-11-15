import type { ArtifactId } from '../../artifacts/artifact-id';
import { useMutation } from '../../lib/use-mutation';
import { useEntityStore } from '../../store/entity-store';
import { trpcClient } from '../../trpc-client';
import { useCurrentUser } from '../../users/use-current-user';
import { NormalizationRunId } from '../normalization-run-id';
import { NormalizationSessionEventEntity } from '../normalization-session-event/normalization-session-event-entity';
import type { NormalizationSessionId } from '../normalization-session-id';
import { NormalizationSessionProjection } from '../normalization-session-projection/normalization-session-projection';

export interface RequestNormalizationParams {
  inputArtifactIds: ArtifactId[];
}

export function useRequestNormalization(sessionId: NormalizationSessionId) {
  const entityStore = useEntityStore();
  const currentUser = useCurrentUser();

  const mutation = useMutation({
    async mutationFn({ inputArtifactIds }: RequestNormalizationParams) {
      const normalizationRunId = NormalizationRunId.generate();
      const output = await trpcClient.normalizationSession.events.append.mutate({
        event: {
          type: 'user-requested-normalization',
          sessionId,
          normalizationRunId,
          inputArtifactIds,
          requestedAt: new Date(),
          requestedByUserId: currentUser.id,
        },
        sessionId,
      });
      const projection = NormalizationSessionProjection.schema.parse(output.projection);
      const event = NormalizationSessionEventEntity.schema.parse(output.event);
      entityStore.addEntity('normalizationSessionProjections', projection);
      entityStore.addEntity('normalizationSessionEvents', event);
    },
  });

  return mutation;
}
