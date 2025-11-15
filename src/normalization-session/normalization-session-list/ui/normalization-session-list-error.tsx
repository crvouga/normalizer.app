import { Button } from '~/src/ui/button';
import { Typography } from '~/src/ui/typography';
import { useI18n } from '~/src/i18n/use-i18n';
import { toI18nText } from '~/src/i18n/types';

interface NormalizationSessionListErrorProps {
  error: Error;
  onRetry?: () => void;
}

/**
 * Error state for the normalization session list.
 */
export function NormalizationSessionListError({
  error,
  onRetry,
}: NormalizationSessionListErrorProps) {
  const { t } = useI18n();
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center">
        <Typography
          variant="sm"
          weight="medium"
          color="error"
          as="p"
          text={t('normalizationSession.list.failedToLoad')}
        />
        <Typography
          variant="xs"
          color="muted"
          as="p"
          className="mt-1"
          text={toI18nText(error.message)}
        />
        {onRetry && (
          <Button
            onClick={onRetry}
            variant="outline"
            size="sm"
            className="mt-4"
            text={t('common.retry')}
          />
        )}
      </div>
    </div>
  );
}
