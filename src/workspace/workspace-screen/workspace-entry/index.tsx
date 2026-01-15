import type { WorkspaceProjectionEntry } from '../../workspace-projection/workspace-projection-entry';
import type { WorkspaceId } from '../../workspace-id';
import { NormalizationEntry } from './normalization-entry';
import { OutputArea } from './output-area';
import { UserInputBubble } from './user-input-bubble';

export const WorkspaceEntry = (props: {
  entry: WorkspaceProjectionEntry;
  workspaceId: WorkspaceId;
}) => {
  switch (props.entry.type) {
    case 'normalization':
      return (
        <div className="flex flex-col gap-2 pb-8">
          <UserInputBubble artifactIds={props.entry.inputArtifactIds} />
          <OutputArea>
            <NormalizationEntry
              entry={props.entry}
              workspaceId={props.workspaceId}
            />
          </OutputArea>
        </div>
      );
    default:
      const _check: never = props.entry.type;
      console.error('Unknown entry type', _check);
      throw new Error('Unknown entry type');
  }
};
