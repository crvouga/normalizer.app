import { X } from 'lucide-react';
import { useI18n } from '~/src/i18n/use-i18n';
import type { WorkspaceProjectionEntry } from '../../workspace-projection/workspace-projection-entry';

export const CanceledEntry = (_props: { entry: WorkspaceProjectionEntry }) => {
  const { t } = useI18n();

  return (
    <div className="flex items-center gap-2 py-2">
      <X className="size-4 text-slate-400 dark:text-slate-500" />
      <span className="text-sm text-slate-500 dark:text-slate-400">
        {t('workspace.canceled')}
      </span>
    </div>
  );
};
