import { useState } from 'react';
import type { ArtifactId } from '../../artifacts/artifact-id';
import { ArtifactsField } from '../../artifacts/artifacts-input/artifacts-field';
import { useI18n } from '../../i18n/use-i18n';
import { useCurrentScreen } from '../../screen/use-current-screen';
import { Form } from '../../ui/form';
import { showErrorToast, showSuccessToast } from '../../ui/toast';
import { Button } from '~/src/ui/button';
import { trpcClient } from '~/src/shared/trpc-client';
import { NormalizationSessionId } from '../normalization-session-id';
import { useMutation } from '~/src/lib/use-mutation';
import { useCurrentUser } from '~/src/users/use-current-user';

export const StartNormalizationSessionScreen = () => {
  const { t } = useI18n();
  const [targetArtifactIds, setTargetArtifactIds] = useState<ArtifactId[]>([]);
  const currentScreen = useCurrentScreen();
  const currentUser = useCurrentUser();

  // Start session mutation
  const mutation = useMutation({
    async mutationFn({ targetArtifactIds }: { targetArtifactIds: ArtifactId[] }) {
      const sessionId = NormalizationSessionId.generate();
      const startedAt = new Date();
      const startedByUserId = currentUser.id;

      const event = {
        type: 'user-started-session' as const,
        sessionId,
        targetArtifactIds,
        startedAt,
        startedByUserId,
      };

      await trpcClient.normalizationSession.events.append.mutate({
        sessionId,
        event,
      });

      return { sessionId };
    },
    onSuccess(data) {
      setTargetArtifactIds([]);
      currentScreen.setCurrentScreen(
        {
          normalizationSessionId: data.sessionId,
          type: 'normalization-session',
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
