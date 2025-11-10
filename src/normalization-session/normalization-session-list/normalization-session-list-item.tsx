import type { NormalizationSessionId } from '../normalization-session-id';
import type { NormalizationSessionProjection } from '../normalization-session-projection';

interface NormalizationSessionListItemProps {
  projection: NormalizationSessionProjection;
  onClick: (id: NormalizationSessionId) => void;
}

/**
 * A single item in the normalization session list.
 * Displays session information and handles click interactions.
 */
export function NormalizationSessionListItem({
  projection,
  onClick,
}: NormalizationSessionListItemProps) {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <button
      type="button"
      onClick={() => onClick(projection.id)}
      className="dark:hover:bg-gray-750 w-full rounded-lg border border-gray-200 bg-white p-4 text-left transition-colors hover:border-gray-300 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600"
    >
      <div className="flex flex-col gap-2">
        {/* Session ID */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Session {projection.id.slice(0, 8)}
          </span>
        </div>

        {/* Metadata */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
          {/* Target artifacts count */}
          <span>
            {projection.targetArtifactIds.length}{' '}
            {projection.targetArtifactIds.length === 1 ? 'artifact' : 'artifacts'}
          </span>

          {/* Started date */}
          <span>Started {formatDate(projection.startedAt)}</span>
        </div>
      </div>
    </button>
  );
}
