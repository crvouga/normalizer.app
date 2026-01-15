import { useState } from 'react';
import { useMutation } from '~/src/lib/use-mutation';
import { trpcClient } from '~/src/shared/trpc-client';
import { Button } from '~/src/ui/button';
import { useCurrentUser } from '~/src/users/use-current-user';
import type { ArtifactId } from '../../artifacts/artifact-id';
import { ArtifactsField } from '../../artifacts/artifacts-input/artifacts-field';
import { useI18n } from '../../i18n/use-i18n';
import { useCurrentScreen } from '../../screen/use-current-screen';
import { Form } from '../../ui/form';
import { showErrorToast, showSuccessToast } from '../../ui/toast';
import { WorkspaceId } from '../workspace-id';
import { WorkspacePayload } from '../workspace-payload/workspace-payload';
import { useAddWorkspacePayloadToStore } from '../workspace-payload/workspace-payload-store';
import type { WorkspaceEvent } from '../workspace-event/workspace-event';

export const StartWorkspaceScreen = () => {
  const { t } = useI18n();
  const [targetArtifactIds, setTargetArtifactIds] = useState<ArtifactId[]>([]);
  const currentScreen = useCurrentScreen();
  const currentUser = useCurrentUser();
  const addToStore = useAddWorkspacePayloadToStore();

  // Start workspace mutation
  const mutation = useMutation({
    async mutationFn({ targetArtifactIds }: { targetArtifactIds: ArtifactId[] }) {
      const workspaceId = WorkspaceId.generate();
      const startedAt = new Date();
      const startedByUserId = currentUser.id;

      const event: WorkspaceEvent = {
        type: 'workspace/user-started',
        workspaceId,
        targetArtifactIds,
        startedAt,
        startedByUserId,
      };

      const response = await trpcClient.workspace.events.append.mutate({
        workspaceId: workspaceId,
        event,
      });

      const payload = WorkspacePayload.schema.parse(response);

      return { sessionId: workspaceId, payload };
    },
    onSuccess(data) {
      addToStore(data.payload);
      setTargetArtifactIds([]);
      currentScreen.setCurrentScreen(
        {
          workspaceId: data.sessionId,
          type: 'workspace',
        },
        'push',
      );
      showSuccessToast(t('session.startSuccess'));
    },
    onError(error) {
      showErrorToast(t('session.startError'), error);
    },
  });

  const isStarting = mutation.isPending;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (targetArtifactIds.length === 0) return;
    mutation.mutate({ targetArtifactIds });
  };

  return (
    <div className="flex h-full w-full items-center justify-center p-8">
      <Form
        onSubmit={handleSubmit}
        disabled={isStarting}
        className="flex w-full max-w-2xl flex-col gap-6"
      >
        <ArtifactsField
          label={t('session.targetArtifact')}
          value={targetArtifactIds}
          onChange={setTargetArtifactIds}
        />

        <div className="flex justify-end">
          <Button
            size="lg"
            type="submit"
            disabled={targetArtifactIds.length === 0}
            loading={isStarting}
            text={t('session.startButton')}
          />
        </div>
      </Form>
    </div>
  );
};
