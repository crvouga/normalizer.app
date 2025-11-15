import type { ArtifactId } from '~/src/artifacts/artifact-id';
import { SelectedArtifactsList } from '~/src/artifacts/artifacts-input/selected-artifacts-list';

export const UserInputBubble = (props: { artifactIds: ArtifactId[] }) => {
  if (props.artifactIds.length === 0) {
    return null;
  }

  return (
    <div className="flex justify-end">
      <div className="w-full max-w-[80%] rounded-2xl rounded-tr-sm bg-slate-100 p-4 dark:bg-slate-800/50">
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
