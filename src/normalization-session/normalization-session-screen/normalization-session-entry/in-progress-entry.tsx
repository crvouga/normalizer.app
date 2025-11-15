import type { ArtifactId } from '~/src/artifacts/artifact-id';
import { Spinner } from '~/src/ui/spinner';
import type { NormalizationSessionProjectionEntry } from '../../normalization-session-projection/normalization-session-projection-entry';
import { EntryArtifactsSection } from './entry-artifacts-section';
import { EntryContainer } from './entry-container';
import { EntryDate } from './entry-date';
import { EntryStatusHeader } from './entry-status-header';

export const InProgressEntry = (props: { entry: NormalizationSessionProjectionEntry }) => {
  return (
    <EntryContainer variant="default">
      <EntryStatusHeader icon={<Spinner size="sm" />} textKey="normalizationSession.inProgress" />
      <EntryArtifactsSection
        artifactIds={props.entry.inputArtifactIds as ArtifactId[]}
        labelKey="normalizationSession.inputArtifactsLabel"
      />
      <EntryDate date={props.entry.createdAt} />
    </EntryContainer>
  );
};
