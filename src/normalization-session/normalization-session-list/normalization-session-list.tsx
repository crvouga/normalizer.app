import { useInfiniteScroll } from '../../lib/use-infinite-scroll';
import type { UserId } from '../../users/user-id';
import { NormalizationSessionListItem } from './normalization-session-list-item';
import type { NormalizationSessionId } from '../normalization-session-id';
import { useNormalizationSessionListLoader } from './use-normalization-session-list-loader';
import { useNormalizationSessionsByUser } from './use-normalization-sessions-by-user';

interface NormalizationSessionProjectionListProps {
  userId: UserId;
  onSessionClick: (id: NormalizationSessionId) => void;
}

/**
 * Infinite scroll list of normalization sessions for a specific user.
 * Loads sessions on mount and as the user scrolls.
 */
export function NormalizationSessionProjectionList({
  userId,
  onSessionClick,
}: NormalizationSessionProjectionListProps) {
  const { state, hasMore, loadMore } = useNormalizationSessionListLoader(userId);
  const sessions = useNormalizationSessionsByUser(userId);

  const loadMoreRef = useInfiniteScroll({
    hasMore,
    isLoading: state.type === 'loading',
    isLoadingMore: state.type === 'loading-more',
    onLoadMore: loadMore,
  });

  // Error state
  if (state.type === 'error') {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center">
          <p className="text-sm font-medium text-red-600 dark:text-red-400">
            Failed to load sessions
          </p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{state.error.message}</p>
        </div>
      </div>
    );
  }

  // Initial loading state
  if (state.type === 'loading' && sessions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600 dark:border-slate-600 dark:border-t-blue-400" />
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">Loading sessions...</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (sessions.length === 0 && state.type === 'loaded') {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
            No normalization sessions
          </p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Start a new session to see it here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex flex-col gap-2 p-4">
        {sessions.map((session) => (
          <NormalizationSessionListItem
            key={session.id}
            projection={session}
            onClick={onSessionClick}
          />
        ))}

        {/* Infinite scroll sentinel */}
        {hasMore && (
          <div ref={loadMoreRef} className="flex items-center justify-center py-4">
            {state.type === 'loading-more' && (
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600 dark:border-slate-600 dark:border-t-blue-400" />
            )}
          </div>
        )}

        {/* No more results indicator */}
        {!hasMore && sessions.length > 0 && (
          <div className="py-4 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-500">No more sessions</p>
          </div>
        )}
      </div>
    </div>
  );
}
