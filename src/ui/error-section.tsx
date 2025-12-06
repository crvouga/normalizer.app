import { useState } from 'react';
import { AlertCircle, Eye, RotateCw } from 'lucide-react';
import { Button } from './button';
import { Typography } from './typography';
import { useI18n } from '~/src/i18n/use-i18n';
import { toI18nText } from '~/src/i18n/types';
import { ErrorDetailsModal } from './error-details-modal';

interface ErrorSectionProps {
  error: Error;
  onRetry?: (() => void) | undefined;
  message?: string;
}

/**
 * Reusable error section component that displays an error message with a "See error" button.
 * The button opens a modal showing the full error details including stack trace.
 */
export function ErrorSection({ error, onRetry, message }: ErrorSectionProps) {
  const { t } = useI18n();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const displayMessage = message || 'An error occurred';

  return (
    <>
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <AlertCircle className="size-6 text-red-600 dark:text-red-400" />
            </div>
          </div>

          <Typography
            variant="sm"
            weight="medium"
            color="error"
            as="p"
            text={toI18nText(displayMessage)}
          />

          <div className="mt-4 flex flex-col items-center gap-8">
            <Button
              onClick={() => setIsModalOpen(true)}
              variant="outline"
              size="sm"
              text={t('errorSection.seeError')}
              startIcon={<Eye />}
            />

            {onRetry && (
              <Button
                onClick={onRetry}
                variant="outline"
                size="sm"
                text={t('common.retry')}
                startIcon={<RotateCw />}
              />
            )}
          </div>
        </div>
      </div>

      <ErrorDetailsModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} error={error} />
    </>
  );
}
