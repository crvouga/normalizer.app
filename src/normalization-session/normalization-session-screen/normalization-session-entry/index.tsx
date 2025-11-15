import type { NormalizationSessionProjectionEntry } from '../../normalization-session-projection/normalization-session-projection-entry';
import { NormalizationEntry } from './normalization-entry';

export const NormalizationSessionEntry = (props: {
  entry: NormalizationSessionProjectionEntry;
}) => {
  switch (props.entry.type) {
    case 'normalization':
      return <NormalizationEntry entry={props.entry} />;
    default:
      const _check: never = props.entry.type;
      console.error('Unknown entry type', _check);
      throw new Error('Unknown entry type');
  }
};
