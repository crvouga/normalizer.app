import type { ArtifactId } from '~/src/artifacts/artifact-id';
import { IconCheck } from '~/src/ui/icons';
import { useI18n } from '~/src/i18n/use-i18n';
import type { NormalizationSessionProjectionEntry } from '../../normalization-session-projection/normalization-session-projection-entry';
import { EntryArtifactsSection } from './entry-artifacts-section';

const StatusIcon = () => {
  return (
    <div className="flex size-6 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
      <IconCheck className="size-4 text-green-600 dark:text-green-400" />
    </div>
  );
};

export const CompletedEntry = (props: { entry: NormalizationSessionProjectionEntry }) => {
  const { t } = useI18n();

  return (
    <div className="flex w-full flex-col py-2">
      <div className="flex items-center gap-2">
        <StatusIcon />
        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
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
