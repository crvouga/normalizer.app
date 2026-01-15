import * as React from 'react';
import type { ArtifactId } from '~/src/artifacts/artifact-id';
import { useI18n } from '~/src/i18n/use-i18n';
import { useMutation } from '~/src/lib/use-mutation';
import { trpcClient } from '~/src/shared/trpc-client';
import { Button } from '~/src/ui/button';
import { IconSparkles } from '~/src/ui/icons';
import { useCurrentUser } from '~/src/users/use-current-user';
import { NormalizationRunId } from '../normalization-run-id';
import type { WorkspaceId } from '../workspace-id';
import { WorkspacePayload } from '../workspace-payload/workspace-payload';
import { useAddWorkspacePayloadToStore } from '../workspace-payload/workspace-payload-store';

export const StartNormalizationButton = (props: {
  workspaceId: WorkspaceId;
  inputArtifactIds: ArtifactId[];
  onStart: () => void;
  disabled?: boolean;
  onSubmitRef?: React.RefObject<(() => void) | null>;
}) => {
  const { t } = useI18n();
  const currentUser = useCurrentUser();
  const addToStore = useAddWorkspacePayloadToStore();

  const mutation = useMutation({
    async mutationFn({ inputArtifactIds }: { inputArtifactIds: ArtifactId[] }) {
      const normalizationRunId = NormalizationRunId.generate();
      const response = await trpcClient.workspace.events.append.mutate({
        event: {
          type: 'user-requested-normalization',
          sessionId: props.workspaceId,
          normalizationRunId,
          inputArtifactIds,
          requestedAt: new Date(),
          requestedByUserId: currentUser.id,
        },
        sessionId: props.workspaceId,
      });
      const payload = WorkspacePayload.schema.parse(response);
      return { payload };
    },
    onSuccess(data) {
      addToStore(data.payload);
      props.onStart();
    },
  });

  const { mutate, isPending } = mutation;

  const handleSubmit = React.useCallback(() => {
    if (props.inputArtifactIds.length === 0 || props.disabled || isPending) {
      return;
    }
    mutate({ inputArtifactIds: props.inputArtifactIds });
  }, [props.inputArtifactIds, props.disabled, isPending, mutate]);

  // Expose submit handler to parent via ref
  React.useEffect(() => {
    if (props.onSubmitRef) {
      props.onSubmitRef.current = handleSubmit;
    }
  }, [handleSubmit, props.onSubmitRef]);

  return (
    <Button
      size="lg"
      startIcon={<IconSparkles className="size-6" />}
      text={t('workspace.normalize')}
      onClick={handleSubmit}
      type="submit"
      loading={isPending}
      disabled={props.inputArtifactIds.length === 0 || props.disabled || isPending}
    />
  );
};
