import { useInfiniteScroll } from '../../lib/use-infinite-scroll';
import type { UserId } from '../../users/user-id';
import type { NormalizationSessionId } from '../normalization-session-id';
import { useNormalizationSessionsByUserLoader } from './use-normalization-sessions-by-user-loader';
import { useNormalizationSessionsByUserSelector } from './use-normalization-sessions-by-user-selector';
import { NormalizationSessionListError } from './ui/normalization-session-list-error';
import { NormalizationSessionListLoading } from './ui/normalization-session-list-loading';
import { NormalizationSessionListEmpty } from './ui/normalization-session-list-empty';
import { NormalizationSessionListLoaded } from './ui/normalization-session-list-loaded';

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
  const { state, hasMore, loadMore } = useNormalizationSessionsByUserLoader(userId);
  const sessions = useNormalizationSessionsByUserSelector(userId);

  const loadMoreRef = useInfiniteScroll({
    hasMore,
    isLoading: state.type === 'loading',
    isLoadingMore: state.type === 'loading-more',
    onLoadMore: loadMore,
  });

  if (state.type === 'error') {
    return <NormalizationSessionListError error={state.error} />;
  }

  if (state.type === 'loading' && sessions.length === 0) {
    return <NormalizationSessionListLoading />;
  }

  if (state.type === 'loaded' && sessions.length === 0) {
    return <NormalizationSessionListEmpty />;
  }

  return (
    <NormalizationSessionListLoaded
      sessions={sessions}
      onSessionClick={onSessionClick}
      hasMore={hasMore}
      isLoadingMore={state.type === 'loading-more'}
      loadMoreRef={loadMoreRef}
    />
  );
}
