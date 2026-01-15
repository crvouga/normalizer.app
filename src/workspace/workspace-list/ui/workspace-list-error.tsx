import { useI18n } from '~/src/i18n/use-i18n';
import { ErrorSection } from '~/src/ui/error-section';

interface WorkspaceListErrorProps {
  error: Error;
  onRetry?: () => void;
}

/**
 * Error state for the normalization session list.
 */
export function WorkspaceListError({
  error,
  onRetry,
}: WorkspaceListErrorProps) {
  const { t } = useI18n();
  return (
    <ErrorSection
      error={error}
      onRetry={onRetry}
      message={t('workspace.list.failedToLoad')}
    />
  );
}
