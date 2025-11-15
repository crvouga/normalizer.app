import { useMemo } from 'react';
import type { NormalizationSessionId } from '../../normalization-session-id';
import type { NormalizationSessionProjectionEntry } from '../../normalization-session-projection/normalization-session-projection-entry';
import { useNormalizationSessionEventsSelector } from '../use-normalization-session-events-selector';

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

export const EntryMetadata = (props: {
  entry: NormalizationSessionProjectionEntry;
  normalizationSessionId: NormalizationSessionId;
}) => {
  const events = useNormalizationSessionEventsSelector(props.normalizationSessionId);

  const duration = useMemo(() => {
    if (props.entry.status === 'in_progress') {
      return null;
    }

    const startTime = props.entry.createdAt.getTime();

    // Find completion or cancellation event
    let endTime: number | null = null;
    for (const eventEntity of events) {
      const event = eventEntity.event;
      if (
        event.type === 'user-canceled-normalization' &&
        event.normalizationRunId === props.entry.normalizationRunId
      ) {
        endTime = event.canceledAt.getTime();
        break;
      }
      // Note: If there are completion events, check for them here
      // For now, we only have cancellation events
    }

    if (!endTime) {
      return null;
    }

    return formatDuration(endTime - startTime);
  }, [events, props.entry]);

  if (!duration) {
    return null;
  }

  return (
    <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
      <span>{duration}</span>
    </div>
  );
};
