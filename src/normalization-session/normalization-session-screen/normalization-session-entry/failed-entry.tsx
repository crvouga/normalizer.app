import type { ArtifactId } from '~/src/artifacts/artifact-id';
import { IconAlertCircle } from '~/src/ui/icons';
import type { NormalizationSessionProjectionEntry } from '../../normalization-session-projection/normalization-session-projection-entry';
import { EntryArtifactsSection } from './entry-artifacts-section';
import { EntryContainer } from './entry-container';
import { EntryDate } from './entry-date';
import { EntryStatusHeader } from './entry-status-header';

const StatusIcon = () => {
  return (
    <div className="flex size-6 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
      <IconAlertCircle className="size-4 text-red-600 dark:text-red-400" />
    </div>
  );
};

export const FailedEntry = (props: { entry: NormalizationSessionProjectionEntry }) => {
  return (
    <EntryContainer variant="error">
      <EntryStatusHeader icon={<StatusIcon />} textKey="normalizationSession.failed" />
      <EntryArtifactsSection
        artifactIds={props.entry.inputArtifactIds as ArtifactId[]}
        labelKey="normalizationSession.inputArtifactsLabel"
      />
      <EntryDate date={props.entry.createdAt} />
    </EntryContainer>
  );
};
