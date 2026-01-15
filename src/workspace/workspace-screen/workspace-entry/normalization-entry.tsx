import type { WorkspaceProjectionEntry } from '../../workspace-projection/workspace-projection-entry';
import type { WorkspaceId } from '../../workspace-id';
import { CanceledEntry } from './canceled-entry';
import { CompletedEntry } from './completed-entry';
import { FailedEntry } from './failed-entry';
import { InProgressEntry } from './in-progress-entry';

export const NormalizationEntry = (props: {
  entry: WorkspaceProjectionEntry;
  workspaceId: WorkspaceId;
}) => {
  switch (props.entry.status) {
    case 'in_progress':
      return <InProgressEntry entry={props.entry} workspaceId={props.workspaceId} />;
    case 'completed':
      return <CompletedEntry entry={props.entry} />;
    case 'failed':
      return <FailedEntry entry={props.entry} />;
    case 'canceled':
      return <CanceledEntry entry={props.entry} />;
  }
};
