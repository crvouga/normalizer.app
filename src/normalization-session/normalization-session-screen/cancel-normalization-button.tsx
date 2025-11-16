import { useI18n } from '~/src/i18n/use-i18n';
import { useMutation } from '~/src/lib/use-mutation';
import { trpcClient } from '~/src/shared/trpc-client';
import { Button } from '~/src/ui/button';
import { IconX } from '~/src/ui/icons';
import { useCurrentUser } from '~/src/users/use-current-user';
import { NormalizationRunId } from '../normalization-run-id';
import type { NormalizationSessionId } from '../normalization-session-id';

export const CancelNormalizationButton = (props: {
  normalizationSessionId: NormalizationSessionId;
  normalizationRunId: NormalizationRunId;
}) => {
  const { t } = useI18n();
  const currentUser = useCurrentUser();

  const mutation = useMutation({
    async mutationFn() {
      await trpcClient.normalizationSession.events.append.mutate({
        event: {
          type: 'user-canceled-normalization',
          sessionId: props.normalizationSessionId,
          normalizationRunId: props.normalizationRunId,
          canceledAt: new Date(),
          canceledByUserId: currentUser.id,
        },
        sessionId: props.normalizationSessionId,
      });
    },
  });

  return (
    <Button
      size="lg"
      variant="outline"
      startIcon={<IconX className="size-6" />}
      text={t('common.cancel')}
      onClick={() => mutation.mutate()}
      loading={mutation.isPending}
      disabled={mutation.isPending}
    />
  );
};
