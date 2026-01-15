import type { ArtifactId } from '~/src/artifacts/artifact-id';
import { Check } from 'lucide-react';
import { useI18n } from '~/src/i18n/use-i18n';
import type { WorkspaceProjectionEntry } from '../../workspace-projection/workspace-projection-entry';
import { EntryArtifactsSection } from './entry-artifacts-section';

const StatusIcon = () => {
  return (
    <div className="flex size-6 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800/50">
      <Check className="size-4 text-slate-400 dark:text-slate-500" />
    </div>
  );
};

export const CompletedEntry = (props: { entry: WorkspaceProjectionEntry }) => {
  const { t } = useI18n();

  return (
    <div className="flex w-full flex-col py-2">
      <div className="flex items-center gap-2">
        <StatusIcon />
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {t('workspace.completed')}
        </span>
      </div>
      <EntryArtifactsSection
        artifactIds={props.entry.outputArtifactIds as ArtifactId[]}
        labelKey="workspace.outputArtifactsLabel"
      />
    </div>
  );
};
