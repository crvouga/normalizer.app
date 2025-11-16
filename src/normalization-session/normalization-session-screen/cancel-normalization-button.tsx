import { useI18n } from '~/src/i18n/use-i18n';
import { useMutation } from '~/src/lib/use-mutation';
import { trpcClient } from '~/src/shared/trpc-client';
import { Button } from '~/src/ui/button';
import { IconX } from '~/src/ui/icons';
import { useCurrentUser } from '~/src/users/use-current-user';
import { NormalizationRunId } from '../normalization-run-id';
import type { NormalizationSessionId } from '../normalization-session-id';
import { useAddProjectionPayloadToStore } from '../normalization-session-projection/add-projection-payload-to-store';

export const CancelNormalizationButton = (props: {
  normalizationSessionId: NormalizationSessionId;
  normalizationRunId: NormalizationRunId;
}) => {
  const { t } = useI18n();
  const currentUser = useCurrentUser();
  const addToStore = useAddProjectionPayloadToStore();

  const mutation = useMutation({
    async mutationFn() {
      const payload = await trpcClient.normalizationSession.events.append.mutate({
        event: {
          type: 'user-canceled-normalization',
          sessionId: props.normalizationSessionId,
          normalizationRunId: props.normalizationRunId,
          canceledAt: new Date(),
          canceledByUserId: currentUser.id,
        },
        sessionId: props.normalizationSessionId,
      });
      return { payload };
    },
    onSuccess(data) {
      addToStore(data.payload);
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
