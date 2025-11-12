import { useEffect, useState } from 'react';
import { trpcClient } from '../trpc-client';
import { useCurrentUser } from '../users/use-current-user';
import type { NormalizationSessionId } from './normalization-session-id';

export interface NormalizationSessionPermission {
  canView: boolean;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to check if the current user has permission to view a normalization session
 */
export function useNormalizationSessionPermission(
  sessionId: NormalizationSessionId,
): NormalizationSessionPermission {
  const currentUser = useCurrentUser();
  const [isLoading, setIsLoading] = useState(true);
  const [canView, setCanView] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    async function checkPermission() {
      try {
        setIsLoading(true);
        setError(null);

        // Check permission by calling the tRPC endpoint
        // This will throw if the user doesn't have permission
        const result = await trpcClient.normalizationSession.permissions.canView.mutate({
          sessionId,
        });

        if (mounted) {
          setCanView(result.canView);
          setIsLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Permission check failed'));
          setCanView(false);
          setIsLoading(false);
        }
      }
    }

    checkPermission();

    return () => {
      mounted = false;
    };
  }, [sessionId, currentUser.id]);

  return { canView, isLoading, error };
}
