import type { NormalizationSessionProjectionEntry } from '../../normalization-session-projection/normalization-session-projection-entry';
import { CompletedEntry } from './completed-entry';
import { FailedEntry } from './failed-entry';
import { InProgressEntry } from './in-progress-entry';
import { PendingEntry } from './pending-entry';

export const NormalizationEntry = (props: { entry: NormalizationSessionProjectionEntry }) => {
  switch (props.entry.status) {
    case 'pending':
      return <PendingEntry inputArtifactIds={props.entry.inputArtifactIds as any} />;
    case 'in_progress':
      return <InProgressEntry entry={props.entry} />;
    case 'completed':
      return <CompletedEntry entry={props.entry} />;
    case 'failed':
      return <FailedEntry entry={props.entry} />;
  }
};
