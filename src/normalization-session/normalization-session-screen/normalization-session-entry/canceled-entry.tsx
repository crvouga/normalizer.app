import { IconX } from '~/src/ui/icons';
import { useI18n } from '~/src/i18n/use-i18n';
import type { NormalizationSessionProjectionEntry } from '../../normalization-session-projection/normalization-session-projection-entry';

export const CanceledEntry = (props: { entry: NormalizationSessionProjectionEntry }) => {
  const { t } = useI18n();

  return (
    <div className="flex items-center gap-2 py-2">
      <IconX className="size-4 text-slate-400 dark:text-slate-500" />
      <span className="text-sm text-slate-500 dark:text-slate-400">
        {t('normalizationSession.canceled')}
      </span>
    </div>
  );
};
