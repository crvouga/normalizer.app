import type { NormalizationLogKind } from './normalization-log';
import type { NormalizationLogSink } from './normalization-log-sink';

export type NormalizationProgressReporter = {
  progress: (message: string) => void;
  reasoning: (delta: string) => void;
  error: (message: string) => void;
};

export function createNormalizationProgressReporter(params: {
  sink: NormalizationLogSink;
}): NormalizationProgressReporter {
  const { sink } = params;

  const push = (kind: NormalizationLogKind, message: string) => {
    if (!message) {
      return;
    }

    sink.push({
      kind,
      level: kind === 'error' ? 'error' : 'info',
      scope: '',
      message,
    });
  };

  return {
    progress: (message) => push('progress', message),
    reasoning: (delta) => push('reasoning', delta),
    error: (message) => push('error', message),
  };
}
