import type { ArtifactId } from '~/src/artifacts/artifact-id';
import { SelectedArtifactsList } from '~/src/artifacts/artifacts-input/selected-artifacts-list';

export const EntryArtifactsSection = (props: { artifactIds: ArtifactId[]; labelKey: string }) => {
  if (props.artifactIds.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 w-full max-w-lg">
      <SelectedArtifactsList
        artifacts={props.artifactIds}
        onRemove={() => {}}
        readOnly
        showPreview={true}
      />
    </div>
  );
};
