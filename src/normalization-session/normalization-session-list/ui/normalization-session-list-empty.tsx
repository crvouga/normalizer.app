import { Typography } from '~/src/ui/typography';
import { toI18nText } from '~/src/i18n/types';

/**
 * Empty state for the normalization session list.
 */
export function NormalizationSessionListEmpty() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center">
        <Typography
          variant="sm"
          weight="medium"
          color="primary"
          className=""
          text={toI18nText('No normalization sessions')}
        />
        <Typography
          variant="xs"
          color="muted"
          className="mt-1"
          text={toI18nText('Start a new session to see it here')}
        />
      </div>
    </div>
  );
}
