import { useMutation } from '../../lib/use-mutation';
import { useEntityStore } from '../../store/entity-store';
import { trpcClient } from '../../trpc-client';
import { useCurrentUser } from '../../users/use-current-user';
import type { NormalizationRunId } from '../normalization-run-id';
import { NormalizationSessionEventEntity } from '../normalization-session-event/normalization-session-event-entity';
import type { NormalizationSessionId } from '../normalization-session-id';
import { NormalizationSessionProjection } from '../normalization-session-projection/normalization-session-projection';

export interface CancelNormalizationParams {
  normalizationRunId: NormalizationRunId;
}

export function useCancelNormalization(sessionId: NormalizationSessionId) {
  const entityStore = useEntityStore();
  const currentUser = useCurrentUser();

  const mutation = useMutation({
    async mutationFn({ normalizationRunId }: CancelNormalizationParams) {
      const output = await trpcClient.normalizationSession.events.append.mutate({
        event: {
          type: 'user-canceled-normalization',
          sessionId,
          normalizationRunId,
          canceledAt: new Date(),
          canceledByUserId: currentUser.id,
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
