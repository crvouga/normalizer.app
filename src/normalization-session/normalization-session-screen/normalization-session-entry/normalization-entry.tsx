import type { NormalizationSessionProjectionEntry } from '../../normalization-session-projection/normalization-session-projection-entry';
import type { NormalizationSessionId } from '../../normalization-session-id';
import { CanceledEntry } from './canceled-entry';
import { CompletedEntry } from './completed-entry';
import { FailedEntry } from './failed-entry';
import { InProgressEntry } from './in-progress-entry';

export const NormalizationEntry = (props: {
  entry: NormalizationSessionProjectionEntry;
  normalizationSessionId: NormalizationSessionId;
}) => {
  switch (props.entry.status) {
    case 'in_progress':
      return (
        <InProgressEntry
          entry={props.entry}
          normalizationSessionId={props.normalizationSessionId}
        />
      );
    case 'completed':
      return <CompletedEntry entry={props.entry} />;
    case 'failed':
      return <FailedEntry entry={props.entry} />;
    case 'canceled':
      return <CanceledEntry entry={props.entry} />;
  }
};
