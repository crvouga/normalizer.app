import type { ArtifactId } from '~/src/artifacts/artifact-id';
import { SelectedArtifactsList } from '~/src/artifacts/artifacts-input/selected-artifacts-list';
import { useI18n } from '~/src/i18n/use-i18n';
import { Typography } from '~/src/ui/typography';

export const EntryArtifactsSection = (props: { artifactIds: ArtifactId[]; labelKey: string }) => {
  const { t } = useI18n();

  if (props.artifactIds.length === 0) {
    return null;
  }

  return (
    <div className="mt-4">
      <Typography
        variant="xs"
        color="muted"
        weight="medium"
        as="p"
        className="mb-2"
        text={t(props.labelKey as any)}
      />
      <SelectedArtifactsList
        artifacts={props.artifactIds}
        onRemove={() => {}}
        readOnly
        showPreview={false}
      />
    </div>
  );
};
