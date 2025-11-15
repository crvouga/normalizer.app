import type { ArtifactId } from '~/src/artifacts/artifact-id';
import { SelectedArtifactsList } from '~/src/artifacts/artifacts-input/selected-artifacts-list';

export const UserInputBubble = (props: { artifactIds: ArtifactId[] }) => {
  if (props.artifactIds.length === 0) {
    return null;
  }

  return (
    <div className="flex justify-end">
      <div className="animate-slide-in-right w-full max-w-lg">
        <SelectedArtifactsList
          artifacts={props.artifactIds}
          onRemove={() => {}}
          readOnly
          showPreview={false}
        />
      </div>
    </div>
  );
};
