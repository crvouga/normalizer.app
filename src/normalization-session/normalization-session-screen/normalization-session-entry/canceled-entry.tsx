import type { ArtifactId } from '~/src/artifacts/artifact-id';
import { IconX } from '~/src/ui/icons';
import type { NormalizationSessionProjectionEntry } from '../../normalization-session-projection/normalization-session-projection-entry';
import { EntryArtifactsSection } from './entry-artifacts-section';
import { EntryContainer } from './entry-container';
import { EntryDate } from './entry-date';
import { EntryStatusHeader } from './entry-status-header';

const StatusIcon = () => {
  return (
    <div className="flex size-6 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30">
      <IconX className="size-4 text-yellow-600 dark:text-yellow-400" />
    </div>
  );
};

export const CanceledEntry = (props: { entry: NormalizationSessionProjectionEntry }) => {
  return (
    <EntryContainer variant="default">
      <EntryStatusHeader icon={<StatusIcon />} textKey="normalizationSession.canceled" />
      <EntryArtifactsSection
        artifactIds={props.entry.inputArtifactIds as ArtifactId[]}
        labelKey="normalizationSession.inputArtifactsLabel"
      />
      <EntryDate date={props.entry.createdAt} />
    </EntryContainer>
  );
};
