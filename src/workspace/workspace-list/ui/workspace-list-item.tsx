import { ButtonBase } from '~/src/ui/button-base';
import { formatDate } from '~/src/lib/date/format-date';
import type { WorkspaceId } from '../../workspace-id';
import type { WorkspaceProjection } from '../../workspace-projection/workspace-projection';
import type { ArtifactId } from '~/src/artifacts/artifact-id';
import type { Artifact } from '~/src/artifacts/artifact';
import { useEntityStoreSelector } from '~/src/store/entity-store';

interface WorkspaceListItemProps {
  projection: WorkspaceProjection;
  onClick: (id: WorkspaceId) => void;
  isSelected: boolean;
}

/**
 * A single item in the workspace list.
 * Displays workspace information and handles click interactions.
 */
export function WorkspaceListItem({ projection, onClick, isSelected }: WorkspaceListItemProps) {
  const targetArtifacts = useEntityStoreSelector((store) =>
    projection.targetArtifactIds.map((id: ArtifactId) => store.entities.artifacts.byId[id]),
  );

  return (
    <ButtonBase
      onClick={() => onClick(projection.id)}
      className={`w-full rounded-lg border p-4 text-left transition-colors ${
        isSelected
          ? 'border-fuchsia-500 bg-fuchsia-50 hover:border-fuchsia-600 hover:bg-fuchsia-100 dark:border-fuchsia-400 dark:bg-fuchsia-950 dark:hover:border-fuchsia-300 dark:hover:bg-fuchsia-900'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600 dark:hover:bg-slate-700'
      }`}
    >
      <div className="flex flex-col gap-2">
        {/* Session ID */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
            {targetArtifacts
              .map((artifact: Artifact | undefined) => artifact?.name ?? artifact?.filename)
              .join(', ')}
          </span>
        </div>

        {/* Metadata */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
          {/* Target artifacts count */}
          <span>
            {projection.targetArtifactIds.length}{' '}
            {projection.targetArtifactIds.length === 1 ? 'artifact' : 'artifacts'}
          </span>

          {/* Started date */}
          <span>Started {formatDate(projection.startedAt)}</span>
        </div>
      </div>
    </ButtonBase>
  );
}
