import { useRef, useState } from 'react';
import type { ArtifactId } from '~/src/artifacts/artifact-id';
import { ArtifactsField } from '~/src/artifacts/artifacts-input/artifacts-field';
import { useI18n } from '~/src/i18n/use-i18n';
import type { NormalizationSessionId } from '../normalization-session-id';
import { Form } from '~/src/ui/form';
import { NormalizationSessionProjection } from '../normalization-session-projection/normalization-session-projection';
import { CancelNormalizationButton } from './cancel-normalization-button';
import { StartNormalizationButton } from './start-normalization-button';

export const NormalizationSessionScreenInputForm = (props: {
  normalizationSessionId: NormalizationSessionId;
  normalizationSessionProjection: NormalizationSessionProjection;
}) => {
  const { t } = useI18n();
  const [inputArtifactIds, setInputArtifactIds] = useState<ArtifactId[]>([]);
  const submitHandlerRef = useRef<(() => void) | null>(null);

  const lastEntry =
    props.normalizationSessionProjection.entries[
      props.normalizationSessionProjection.entries.length - 1
    ];
  const isLastEntryInProgress = lastEntry?.status === 'in_progress';

  const handleStart = () => {
    setInputArtifactIds([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitHandlerRef.current?.();
  };

  return (
    <Form onSubmit={handleSubmit} contentClassName="space-y-4">
      <ArtifactsField
        label={t('normalizationSession.inputArtifactsLabel')}
        value={inputArtifactIds}
        onChange={setInputArtifactIds}
      />
      <div className="flex justify-end">
        {isLastEntryInProgress && lastEntry?.type === 'normalization' ? (
          <CancelNormalizationButton
            normalizationSessionId={props.normalizationSessionId}
            normalizationRunId={lastEntry.normalizationRunId}
          />
        ) : (
          <StartNormalizationButton
            normalizationSessionId={props.normalizationSessionId}
            inputArtifactIds={inputArtifactIds}
            onStart={handleStart}
            disabled={isLastEntryInProgress}
            onSubmitRef={submitHandlerRef}
          />
        )}
      </div>
    </Form>
  );
};
