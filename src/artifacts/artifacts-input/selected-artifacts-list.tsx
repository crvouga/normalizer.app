import { Typography } from '~/src/ui/typography';
import type { ArtifactId } from '../artifact-id';
import { useEntityStoreSelector } from '../../store/entity-store';
import { SelectedArtifactBadge } from './selected-artifact-badge';

export interface SelectedArtifactsListProps {
  artifacts: ArtifactId[];
  onRemove: (artifactId: ArtifactId) => void;
  title: string;
}

/**
 * Component for displaying a list of selected artifacts as removable badges.
 * Only renders when there are artifacts to display.
 * Fetches artifact entities from the entity store to display details.
 */
export function SelectedArtifactsList({ artifacts, onRemove, title }: SelectedArtifactsListProps) {
  const artifactsById = useEntityStoreSelector((state) => state.entities.artifacts.byId);

  if (artifacts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <Typography variant="sm" weight="medium" color="primary">
        {title}
      </Typography>
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
