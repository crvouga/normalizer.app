import type { ArtifactId } from '~/src/artifacts/artifact-id';
import { ArtifactsField } from '~/src/artifacts/artifacts-input/artifacts-field';
import { useI18n } from '~/src/i18n/use-i18n';

export const WorkspaceScreenHeader = (props: { targetArtifactIds: ArtifactId[] }) => {
  const { t } = useI18n();

  return (
    <div className="shrink-0 border-b border-slate-200 dark:border-slate-700">
      <div className="flex w-full flex-col items-center justify-center px-6 py-4">
        <div className="w-full max-w-4xl">
          <ArtifactsField
            label={t('workspace.targetArtifactsLabel')}
            value={props.targetArtifactIds}
            onChange={() => {}}
            readOnly
          />
        </div>
      </div>
    </div>
  );
};
