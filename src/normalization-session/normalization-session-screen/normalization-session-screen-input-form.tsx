import { useState } from 'react';
import type { ArtifactId } from '~/src/artifacts/artifact-id';
import { ArtifactsField } from '~/src/artifacts/artifacts-input/artifacts-field';
import { useI18n } from '~/src/i18n/use-i18n';
import { Button } from '~/src/ui/button';
import { IconSparkles } from '~/src/ui/icons';
import type { NormalizationSessionId } from '../normalization-session-id';

import { useMutation } from '~/src/lib/use-mutation';
import { useEntityStore } from '~/src/store/entity-store';
import { trpcClient } from '~/src/trpc-client';
import { Form } from '~/src/ui/form';
import { useCurrentUser } from '~/src/users/use-current-user';
import { NormalizationRunId } from '../normalization-run-id';
import { NormalizationSessionEventEntity } from '../normalization-session-event/normalization-session-event-entity';
import { NormalizationSessionProjection } from '../normalization-session-projection/normalization-session-projection';

export const NormalizationSessionScreenInputForm = (props: {
  normalizationSessionId: NormalizationSessionId;
  normalizationSessionProjection: NormalizationSessionProjection;
}) => {
  const { t } = useI18n();
  const [inputArtifactIds, setInputArtifactIds] = useState<ArtifactId[]>([]);

  const entityStore = useEntityStore();
  const currentUser = useCurrentUser();
  const mutation = useMutation({
    async mutationFn({ inputArtifactIds }: { inputArtifactIds: ArtifactId[] }) {
      const normalizationRunId = NormalizationRunId.generate();
      const output = await trpcClient.normalizationSession.events.append.mutate({
        event: {
          type: 'user-requested-normalization',
          sessionId: props.normalizationSessionId,
          normalizationRunId,
          inputArtifactIds,
          requestedAt: new Date(),
          requestedByUserId: currentUser.id,
        },
        sessionId: props.normalizationSessionId,
      });
      const projection = NormalizationSessionProjection.schema.parse(output.projection);
      const event = NormalizationSessionEventEntity.schema.parse(output.event);
      entityStore.addEntity('normalizationSessionProjections', projection);
      entityStore.addEntity('normalizationSessionEvents', event);
    },
    onStart() {
      setInputArtifactIds([]);
    },
  });

  const lastEntry =
    props.normalizationSessionProjection.entries[
      props.normalizationSessionProjection.entries.length - 1
    ];
  const isLastEntryInProgress = lastEntry?.status === 'in_progress';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputArtifactIds.length === 0 || isLastEntryInProgress || mutation.isPending) {
      return;
    }
    mutation.mutate({ inputArtifactIds });
  };

  return (
    <Form onSubmit={handleSubmit} disabled={isLastEntryInProgress} contentClassName="space-y-4">
      <ArtifactsField
        label={t('normalizationSession.inputArtifactsLabel')}
        value={inputArtifactIds}
        onChange={setInputArtifactIds}
      />
      <div className="flex justify-end">
        <Button
          size="lg"
          startIcon={<IconSparkles className="size-6" />}
          text={t('normalizationSession.normalize')}
          type="submit"
          loading={mutation.isPending}
          disabled={inputArtifactIds.length === 0 || isLastEntryInProgress}
        />
      </div>
    </Form>
  );
};
