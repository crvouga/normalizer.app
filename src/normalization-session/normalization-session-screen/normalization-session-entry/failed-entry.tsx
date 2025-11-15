import { IconAlertCircle } from '~/src/ui/icons';
import { useI18n } from '~/src/i18n/use-i18n';
import type { NormalizationSessionProjectionEntry } from '../../normalization-session-projection/normalization-session-projection-entry';

const StatusIcon = () => {
  return (
    <div className="flex size-6 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
      <IconAlertCircle className="size-4 text-red-600 dark:text-red-400" />
    </div>
  );
};

export const FailedEntry = (props: { entry: NormalizationSessionProjectionEntry }) => {
  const { t } = useI18n();

  return (
    <div className="flex items-center gap-3 py-2">
      <StatusIcon />
      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
        {t('normalizationSession.failed')}
      </span>
    </div>
  );
};
