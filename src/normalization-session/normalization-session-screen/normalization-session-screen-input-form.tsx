import { useState } from 'react';
import type { ArtifactId } from '~/src/artifacts/artifact-id';
import { ArtifactsField } from '~/src/artifacts/artifacts-input/artifacts-field';
import { useI18n } from '~/src/i18n/use-i18n';
import { Button } from '~/src/ui/button';
import { IconSparkles } from '~/src/ui/icons';
import type { NormalizationSessionId } from '../normalization-session-id';
import { useRequestNormalization } from './use-request-normalization';
import type { NormalizationSessionProjection } from '../normalization-session-projection/normalization-session-projection';
import { Form } from '~/src/ui/form';

export const NormalizationSessionScreenInputForm = (props: {
  normalizationSessionId: NormalizationSessionId;
  normalizationSessionProjection: NormalizationSessionProjection;
}) => {
  const { t } = useI18n();
  const [inputArtifactIds, setInputArtifactIds] = useState<ArtifactId[]>([]);

  const requestNormalization = useRequestNormalization(props.normalizationSessionId);

  const lastEntry =
    props.normalizationSessionProjection.entries[
      props.normalizationSessionProjection.entries.length - 1
    ];
  const isLastEntryInProgress = lastEntry?.status === 'in_progress';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputArtifactIds.length === 0 || isLastEntryInProgress || requestNormalization.isPending) {
      return;
    }
    requestNormalization.mutate({ inputArtifactIds });
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
          loading={requestNormalization.isPending}
          disabled={inputArtifactIds.length === 0 || isLastEntryInProgress}
        />
      </div>
    </Form>
  );
};
