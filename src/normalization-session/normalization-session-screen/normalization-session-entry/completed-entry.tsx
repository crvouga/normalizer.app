import type { ArtifactId } from '~/src/artifacts/artifact-id';
import { IconCheck } from '~/src/ui/icons';
import type { NormalizationSessionProjectionEntry } from '../../normalization-session-projection/normalization-session-projection-entry';
import { EntryArtifactsSection } from './entry-artifacts-section';
import { EntryContainer } from './entry-container';
import { EntryDate } from './entry-date';
import { EntryStatusHeader } from './entry-status-header';

const StatusIcon = () => {
  return (
    <div className="flex size-6 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
      <IconCheck className="size-4 text-green-600 dark:text-green-400" />
    </div>
  );
};

export const CompletedEntry = (props: { entry: NormalizationSessionProjectionEntry }) => {
  return (
    <EntryContainer variant="success">
      <EntryStatusHeader icon={<StatusIcon />} textKey="normalizationSession.completed" />
      <EntryArtifactsSection
        artifactIds={props.entry.inputArtifactIds as ArtifactId[]}
        labelKey="normalizationSession.inputArtifactsLabel"
      />
      <EntryArtifactsSection
        artifactIds={props.entry.outputArtifactIds as ArtifactId[]}
        labelKey="normalizationSession.outputArtifactsLabel"
      />
      <EntryDate date={props.entry.createdAt} />
    </EntryContainer>
  );
};
