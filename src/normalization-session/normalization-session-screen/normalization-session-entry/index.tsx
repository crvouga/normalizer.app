import type { NormalizationSessionProjectionEntry } from '../../normalization-session-projection/normalization-session-projection-entry';
import type { NormalizationSessionId } from '../../normalization-session-id';
import { NormalizationEntry } from './normalization-entry';
import { OutputArea } from './output-area';
import { UserInputBubble } from './user-input-bubble';

export const NormalizationSessionEntry = (props: {
  entry: NormalizationSessionProjectionEntry;
  normalizationSessionId: NormalizationSessionId;
}) => {
  switch (props.entry.type) {
    case 'normalization':
      return (
        <div className="flex flex-col gap-2 pb-8">
          <UserInputBubble artifactIds={props.entry.inputArtifactIds} />
          <OutputArea>
            <NormalizationEntry
              entry={props.entry}
              normalizationSessionId={props.normalizationSessionId}
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
