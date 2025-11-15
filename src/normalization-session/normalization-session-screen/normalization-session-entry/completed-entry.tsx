import type { ArtifactId } from '~/src/artifacts/artifact-id';
import { IconCheck } from '~/src/ui/icons';
import { useI18n } from '~/src/i18n/use-i18n';
import type { NormalizationSessionProjectionEntry } from '../../normalization-session-projection/normalization-session-projection-entry';
import { EntryArtifactsSection } from './entry-artifacts-section';

const StatusIcon = () => {
  return (
    <div className="flex size-6 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800/50">
      <IconCheck className="size-4 text-slate-400 dark:text-slate-500" />
    </div>
  );
};

export const CompletedEntry = (props: { entry: NormalizationSessionProjectionEntry }) => {
  const { t } = useI18n();

  return (
    <div className="flex w-full flex-col py-2">
      <div className="flex items-center gap-2">
        <StatusIcon />
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {t('normalizationSession.completed')}
        </span>
      </div>
      <EntryArtifactsSection
        artifactIds={props.entry.outputArtifactIds as ArtifactId[]}
        labelKey="normalizationSession.outputArtifactsLabel"
      />
    </div>
  );
};
