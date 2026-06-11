import { NormalizationLogFeed } from '../../normalization-log/normalization-log-feed';
import type { WorkspaceProjectionEntry } from '../../workspace-projection/workspace-projection-entry';
import type { WorkspaceId } from '../../workspace-id';
import { CanceledEntry } from './canceled-entry';
import { CompletedEntry } from './completed-entry';
import { FailedEntry } from './failed-entry';

export const NormalizationEntry = (props: {
  entry: WorkspaceProjectionEntry;
  workspaceId: WorkspaceId;
}) => {
  const statusContent = (() => {
    switch (props.entry.status) {
      case 'in_progress':
        return null;
      case 'completed':
        return <CompletedEntry entry={props.entry} />;
      case 'failed':
        return <FailedEntry entry={props.entry} />;
      case 'canceled':
        return <CanceledEntry entry={props.entry} />;
    }
  })();

  return (
    <div className="flex w-full flex-col gap-2">
      {statusContent}
      <NormalizationLogFeed
        workspaceId={props.workspaceId}
        normalizationRunId={props.entry.normalizationRunId}
        status={props.entry.status}
      />
    </div>
  );
};
