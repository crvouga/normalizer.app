import type { NormalizationSessionProjectionEntry } from '../../normalization-session-projection/normalization-session-projection-entry';
import type { NormalizationSessionId } from '../../normalization-session-id';
import { NormalizationEntry } from './normalization-entry';

export const NormalizationSessionEntry = (props: {
  entry: NormalizationSessionProjectionEntry;
  normalizationSessionId: NormalizationSessionId;
}) => {
  switch (props.entry.type) {
    case 'normalization':
      return (
        <NormalizationEntry
          entry={props.entry}
          normalizationSessionId={props.normalizationSessionId}
        />
      );
    default:
      const _check: never = props.entry.type;
      console.error('Unknown entry type', _check);
      throw new Error('Unknown entry type');
  }
};
