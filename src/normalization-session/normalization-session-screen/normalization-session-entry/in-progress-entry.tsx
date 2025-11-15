import { useI18n } from '~/src/i18n/use-i18n';
import { IconSparkles } from '~/src/ui/icons';
import { Typography } from '~/src/ui/typography';
import type { NormalizationSessionId } from '../../normalization-session-id';
import type { NormalizationSessionProjectionEntry } from '../../normalization-session-projection/normalization-session-projection-entry';

export const InProgressEntry = (props: {
  entry: NormalizationSessionProjectionEntry;
  normalizationSessionId: NormalizationSessionId;
}) => {
  const { t } = useI18n();

  if (props.entry.type !== 'normalization') {
    throw new Error('InProgressEntry can only render normalization entries');
  }

  return (
    <div className="flex items-center gap-2 py-2">
      <IconSparkles className="size-5 text-fuchsia-500 dark:text-fuchsia-400" />
      <Typography
        variant="sm"
        color="fuchsia"
        weight="medium"
        as="p"
        className="animate-pulse"
        text={t('normalizationSession.normalizing')}
      />
    </div>
  );
};
