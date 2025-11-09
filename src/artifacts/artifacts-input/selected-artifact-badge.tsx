import { Typography } from '~/src/ui/typography';
import type { Artifact } from '../artifact';
import type { ArtifactId } from '../artifact-id';
import { IconSpinner, IconX } from '../../ui/icons';

export interface SelectedArtifactBadgeProps {
  artifact?: Artifact;
  artifactId: ArtifactId;
  onRemove: (artifactId: ArtifactId) => void;
}

/**
 * Badge component for displaying a selected artifact with a remove button.
 * Shows a spinner and different styling when the artifact is uploading (status === 'pending').
 * Displays the artifact filename if available, otherwise shows the ID.
 */
export function SelectedArtifactBadge({
  artifact,
  artifactId,
  onRemove,
}: SelectedArtifactBadgeProps) {
  const isUploading = artifact?.status === 'pending';
  const displayName = artifact?.filename || artifactId;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 ${
        isUploading ? 'bg-gray-100 opacity-75 dark:bg-gray-700' : ''
      }`}
    >
      {isUploading && <IconSpinner className="size-4 text-gray-600 dark:text-gray-400" />}
      <Typography
        variant="sm"
        className={
          isUploading ? 'text-gray-700 dark:text-gray-300' : 'text-blue-800 dark:text-blue-200'
        }
      >
        {displayName}
      </Typography>
      <button
        onClick={() => onRemove(artifactId)}
        disabled={isUploading}
        className={`${
          isUploading
            ? 'cursor-not-allowed text-gray-600 opacity-50 dark:text-gray-400'
            : 'text-blue-800 hover:text-blue-900 dark:text-blue-200 dark:hover:text-blue-100'
        }`}
        aria-label={`Remove ${displayName}`}
      >
        <IconX className="size-4" />
      </button>
    </span>
  );
}
