import type { WorkspaceId } from '../../workspace-id';
import { NormalizationLogFeed } from '../../normalization-log/normalization-log-feed';
import type { WorkspaceProjectionEntry } from '../../workspace-projection/workspace-projection-entry';

export const InProgressEntry = (props: {
  entry: WorkspaceProjectionEntry;
  workspaceId: WorkspaceId;
}) => {
  if (props.entry.type !== 'normalization') {
    throw new Error('InProgressEntry can only render normalization entries');
  }

  return (
    <NormalizationLogFeed
      workspaceId={props.workspaceId}
      normalizationRunId={props.entry.normalizationRunId}
    />
  );
};
