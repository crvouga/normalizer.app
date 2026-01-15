import { useI18n } from '~/src/i18n/use-i18n';
import { useMutation } from '~/src/lib/use-mutation';
import { trpcClient } from '~/src/shared/trpc-client';
import { Button } from '~/src/ui/button';
import { X } from 'lucide-react';
import { useCurrentUser } from '~/src/users/use-current-user';
import { NormalizationRunId } from '../normalization-run-id';
import type { WorkspaceId } from '../workspace-id';
import { WorkspacePayload } from '../workspace-payload/workspace-payload';
import { useAddWorkspacePayloadToStore } from '../workspace-payload/workspace-payload-store';

export const CancelNormalizationButton = (props: {
  workspaceId: WorkspaceId;
  normalizationRunId: NormalizationRunId;
}) => {
  const { t } = useI18n();
  const currentUser = useCurrentUser();
  const addToStore = useAddWorkspacePayloadToStore();

  const mutation = useMutation({
    async mutationFn() {
      const response = await trpcClient.workspace.events.append.mutate({
        event: {
          type: 'normalization/user-canceled',
          workspaceId: props.workspaceId,
          normalizationRunId: props.normalizationRunId,
          canceledAt: new Date(),
          canceledByUserId: currentUser.id,
        },
        workspaceId: props.workspaceId,
      });
      const payload = WorkspacePayload.schema.parse(response);
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
      startIcon={<X className="size-6" />}
      text={t('common.cancel')}
      onClick={() => mutation.mutate()}
      loading={mutation.isPending}
      disabled={mutation.isPending}
    />
  );
};
