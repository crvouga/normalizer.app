import type { NormalizationLogKind } from './normalization-log';
import type { NormalizationLogSink } from './normalization-log-sink';
import type { QueryResultLogMeta } from './query-result-log-meta';

export type NormalizationProgressReporter = {
  progress: (message: string) => void;
  reasoning: (delta: string) => void;
  error: (message: string) => void;
  queryResult: (input: { message: string; meta: QueryResultLogMeta }) => void;
};

export function createNormalizationProgressReporter(params: {
  sink: NormalizationLogSink;
}): NormalizationProgressReporter {
  const { sink } = params;

  const push = (kind: NormalizationLogKind, message: string, meta?: Record<string, unknown>) => {
    if (!message) {
      return;
    }

    sink.push({
      kind,
      level: kind === 'error' ? 'error' : 'info',
      scope: '',
      message,
      ...(meta !== undefined ? { meta } : {}),
    });
  };

  return {
    progress: (message) => push('progress', message),
    reasoning: (delta) => push('reasoning', delta),
    error: (message) => push('error', message),
    queryResult: (input) => push('query_result', input.message, input.meta),
  };
}
