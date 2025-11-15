import { useMutation } from '~/src/lib/use-mutation';
import { useEntityStore } from '~/src/store/entity-store';
import { trpcClient } from '~/src/shared/trpc-client';
import { Button } from '~/src/ui/button';
import { IconX } from '~/src/ui/icons';
import { useCurrentUser } from '~/src/users/use-current-user';
import { useI18n } from '~/src/i18n/use-i18n';
import type { NormalizationSessionId } from '../normalization-session-id';
import { NormalizationRunId } from '../normalization-run-id';
import { NormalizationSessionEventEntity } from '../normalization-session-event/normalization-session-event-entity';
import { NormalizationSessionProjection } from '../normalization-session-projection/normalization-session-projection';

export const CancelNormalizationButton = (props: {
  normalizationSessionId: NormalizationSessionId;
  normalizationRunId: NormalizationRunId;
}) => {
  const { t } = useI18n();
  const entityStore = useEntityStore();
  const currentUser = useCurrentUser();

  const mutation = useMutation({
    async mutationFn({ normalizationRunId }: { normalizationRunId: NormalizationRunId }) {
      const output = await trpcClient.normalizationSession.events.append.mutate({
        event: {
          type: 'user-canceled-normalization',
          sessionId: props.normalizationSessionId,
          normalizationRunId,
          canceledAt: new Date(),
          canceledByUserId: currentUser.id,
        },
        sessionId: props.normalizationSessionId,
      });
      const projection = NormalizationSessionProjection.schema.parse(output.projection);
      const event = NormalizationSessionEventEntity.schema.parse(output.event);
      entityStore.addEntity('normalizationSessionProjections', projection);
      entityStore.addEntity('normalizationSessionEvents', event);
    },
  });

  const handleClick = () => {
    if (mutation.isPending) {
      return;
    }
    mutation.mutate({ normalizationRunId: props.normalizationRunId });
  };

  return (
    <Button
      size="lg"
      variant="outline"
      startIcon={<IconX className="size-6" />}
      text={t('common.cancel')}
      onClick={handleClick}
      loading={mutation.isPending}
      disabled={mutation.isPending}
    />
  );
};
