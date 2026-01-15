import { useRef, useState } from 'react';
import type { ArtifactId } from '~/src/artifacts/artifact-id';
import { ArtifactsField } from '~/src/artifacts/artifacts-input/artifacts-field';
import { useI18n } from '~/src/i18n/use-i18n';
import type { WorkspaceId } from '../workspace-id';
import { Form } from '~/src/ui/form';
import { WorkspaceProjection } from '../workspace-projection/workspace-projection';
import { CancelNormalizationButton } from './cancel-normalization-button';
import { StartNormalizationButton } from './start-normalization-button';

export const WorkspaceScreenInputForm = (props: {
  workspaceId: WorkspaceId;
  workspaceProjection: WorkspaceProjection;
}) => {
  const { t } = useI18n();
  const [inputArtifactIds, setInputArtifactIds] = useState<ArtifactId[]>([]);
  const submitHandlerRef = useRef<(() => void) | null>(null);

  const lastEntry =
    props.workspaceProjection.entries[
      props.workspaceProjection.entries.length - 1
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
        label={t('workspace.inputArtifactsLabel')}
        value={inputArtifactIds}
        onChange={setInputArtifactIds}
      />
      <div className="flex justify-end">
        {isLastEntryInProgress && lastEntry?.type === 'normalization' ? (
          <CancelNormalizationButton
            workspaceId={props.workspaceId}
            normalizationRunId={lastEntry.normalizationRunId}
          />
        ) : (
        <StartNormalizationButton
          workspaceId={props.workspaceId}
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
