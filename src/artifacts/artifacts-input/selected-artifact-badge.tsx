import { Typography } from '~/src/ui/typography';
import type { ArtifactId } from '../artifact-id';
import { IconX } from '../../ui/icons';

export interface SelectedArtifactBadgeProps {
  artifactId: ArtifactId;
  onRemove: (artifactId: ArtifactId) => void;
}

/**
 * Badge component for displaying a selected artifact with a remove button.
 */
export function SelectedArtifactBadge({ artifactId, onRemove }: SelectedArtifactBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 dark:bg-blue-900">
      <Typography variant="sm" className="text-blue-800 dark:text-blue-200">
        {artifactId}
      </Typography>
      <button
        onClick={() => onRemove(artifactId)}
        className="text-blue-800 hover:text-blue-900 dark:text-blue-200 dark:hover:text-blue-100"
        aria-label={`Remove ${artifactId}`}
      >
        <IconX className="size-4" />
      </button>
    </span>
  );
}
