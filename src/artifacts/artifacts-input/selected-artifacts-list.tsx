import { Typography } from '~/src/ui/typography';
import type { ArtifactId } from '../artifact-id';
import { useEntityStoreSelector } from '../../store/entity-store';
import { SelectedArtifactBadge } from './selected-artifact-badge';

export interface SelectedArtifactsListProps {
  artifacts: ArtifactId[];
  onRemove: (artifactId: ArtifactId) => void;
  onClearAll?: () => void;
  title: string;
}

/**
 * Component for displaying a list of selected artifacts as removable badges.
 * Only renders when there are artifacts to display.
 * Fetches artifact entities from the entity store to display details.
 * Uses a similar structure to TabularFileList with header and action buttons.
 */
export function SelectedArtifactsList({
  artifacts,
  onRemove,
  onClearAll,
  title,
}: SelectedArtifactsListProps) {
  const artifactsById = useEntityStoreSelector((state) => state.entities.artifacts.byId);

  if (artifacts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Typography as="h4" variant="sm" weight="medium" color="primary">
          {title} ({artifacts.length})
        </Typography>
        {onClearAll && (
          <button type="button" onClick={onClearAll} className="transition-colors">
            <Typography
              variant="xs"
              color="muted"
              className="hover:text-red-600 dark:hover:text-red-400"
            >
              Clear all
            </Typography>
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {artifacts.map((id) => {
          const artifact = artifactsById[id];
          return (
            <SelectedArtifactBadge
              key={id}
              artifact={artifact}
              artifactId={id}
              onRemove={onRemove}
            />
          );
        })}
      </div>
    </div>
  );
}
