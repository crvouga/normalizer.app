import { useMemo, useState } from 'react';
import type { RemoteResult, Result } from '../lib/result';
import { Err, Failure, Loading, NotAsked, Ok, Success } from '../lib/result';
import { useEntityStore } from '../store/entity-store';
import { trpcClient } from '../trpc-client';
import { showErrorToast, showSuccessToast } from '../ui/toast';
import { useI18n } from '../i18n/use-i18n';
import type { ArtifactId } from '../artifacts/artifact-id';
import type { NormalizationSessionId } from './normalization-session-id';
import { NormalizationSessionId as NormalizationSessionIdGenerator } from './normalization-session-id';
import { useCurrentUser } from '../users/use-current-user';

export interface StartNormalizationSessionParams {
  targetArtifactIds: ArtifactId[];
}

export interface StartNormalizationSessionResult {
  sessionId: NormalizationSessionId;
  eventId: string;
}

export function useStartNormalizationSession({
  onStartComplete,
}: {
  onStartComplete?: (result: Result<StartNormalizationSessionResult, Error>) => void;
}) {
  const [state, setState] =
    useState<RemoteResult<StartNormalizationSessionResult, Error>>(NotAsked);
  const entityStore = useEntityStore();
  const { t } = useI18n();
  const { currentUserResult } = useCurrentUser();

  const startSession = async (params: StartNormalizationSessionParams) => {
    // Check if user is loaded
    if (currentUserResult.tag !== 'ok') {
      const error = new Error('User not loaded');
      setState(Failure(error));
      showErrorToast(t('session.startError'), error);
      onStartComplete?.(Err(error));
      return;
    }

    setState(Loading);

    try {
      const sessionId = NormalizationSessionIdGenerator.generate();
      const startedAt = new Date();
      const startedByUserId = currentUserResult.value.id;

      // Create the start-session event
      const event = {
        type: 'start-session' as const,
        sessionId,
        targetArtifactIds: params.targetArtifactIds,
        startedAt,
        startedByUserId,
      };

      // Call the backend to append the event
      const { eventId } = await trpcClient.normalizationSession.appendEvent.mutate({
        sessionId,
        event,
      });

      // Add the event to the entity store
      entityStore.addEntity('normalizationSessionEvents', {
        id: eventId,
        normalization_session_id: sessionId,
        event,
        created_at: startedAt,
      });

      const result: StartNormalizationSessionResult = { sessionId, eventId };

      setState(Success(result));
      showSuccessToast(t('session.startSuccess'));
      onStartComplete?.(Ok(result));

      return result;
    } catch (error) {
      setState(Failure(error as Error));
      showErrorToast(t('session.startError'), error);
      onStartComplete?.(Err(error as Error));
      throw error;
    }
  };

  const isStarting = useMemo(() => state.tag === 'loading', [state]);

  return {
    startSession,
    state,
    isStarting,
  };
}
