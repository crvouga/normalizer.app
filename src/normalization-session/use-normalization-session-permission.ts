import type { NormalizationSessionId } from './normalization-session-id';
import { usePermission } from '../permissions/use-permission';
import {
  canViewNormalizationSession,
  canEditNormalizationSession,
  canDeleteNormalizationSession,
} from './normalization-session-permissions';

export interface NormalizationSessionPermission {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to check normalization session permissions from entity store
 *
 * This hook reads permissions from the entity store that were previously loaded
 * (e.g., by useNormalizationSessionEventsLoader).
 */
export function useNormalizationSessionPermission(
  sessionId: NormalizationSessionId,
): NormalizationSessionPermission {
  // Get permissions from entity store
  const viewPermission = usePermission(canViewNormalizationSession(sessionId));
  const editPermission = usePermission(canEditNormalizationSession(sessionId));
  const deletePermission = usePermission(canDeleteNormalizationSession(sessionId));

  // Aggregate loading state - we're loading if any permission is still loading
  const isLoading =
    viewPermission.isLoading || editPermission.isLoading || deletePermission.isLoading;

  // Check if any permission check has an error (convert to Error object)
  let error: Error | null = null;
  if (viewPermission.reason && !viewPermission.granted && !viewPermission.isLoading) {
    error = new Error(viewPermission.reason);
  }

  return {
    canView: viewPermission.granted,
    canEdit: editPermission.granted,
    canDelete: deletePermission.granted,
    isLoading,
    error,
  };
}
