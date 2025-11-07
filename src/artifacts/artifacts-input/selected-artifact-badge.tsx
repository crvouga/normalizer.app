import { Typography } from '~/src/ui/typography';
import type { ArtifactId } from '../artifact-id';
import { IconSpinner, IconX } from '../../ui/icons';

export interface SelectedArtifactBadgeProps {
  artifactId: ArtifactId;
  onRemove: (artifactId: ArtifactId) => void;
  isUploading?: boolean;
}

/**
 * Badge component for displaying a selected artifact with a remove button.
 * Shows a spinner and different styling when the artifact is uploading.
 */
export function SelectedArtifactBadge({
  artifactId,
  onRemove,
  isUploading = false,
}: SelectedArtifactBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 ${
        isUploading
          ? 'bg-gray-100 dark:bg-gray-700 opacity-75'
          : 'bg-blue-100 dark:bg-blue-900'
      }`}
    >
      {isUploading && <IconSpinner className="size-4 text-gray-600 dark:text-gray-400" />}
      <Typography
        variant="sm"
        className={
          isUploading
            ? 'text-gray-700 dark:text-gray-300'
            : 'text-blue-800 dark:text-blue-200'
        }
      >
        {artifactId}
      </Typography>
      <button
        onClick={() => onRemove(artifactId)}
        disabled={isUploading}
        className={`${
          isUploading
            ? 'cursor-not-allowed opacity-50 text-gray-600 dark:text-gray-400'
            : 'text-blue-800 hover:text-blue-900 dark:text-blue-200 dark:hover:text-blue-100'
        }`}
        aria-label={`Remove ${artifactId}`}
      >
        <IconX className="size-4" />
      </button>
    </span>
  );
}
