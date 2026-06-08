import type { Logger } from '~/src/lib/logger';
import type { NormalizationLogLevel } from './normalization-log';
import type { NormalizationLogSink } from './normalization-log-sink';

const buildChildScope = (parentScope: string | undefined, childName: string): string => {
  return parentScope ? `${parentScope} ${childName}` : childName;
};

const makeLogFn = (
  level: NormalizationLogLevel,
  base: Logger,
  sink: NormalizationLogSink,
  scope: string | undefined,
) => {
  return (message: string, meta?: Record<string, unknown>) => {
    base[level](message, meta);
    sink.push({
      level,
      scope: scope ?? '',
      message,
      ...(meta !== undefined ? { meta } : {}),
    });
  };
};

export function createStreamingLogger(params: {
  base: Logger;
  sink: NormalizationLogSink;
  scope?: string;
}): Logger {
  const { base, sink, scope } = params;

  return {
    child: (name: string) =>
      createStreamingLogger({
        base: base.child(name),
        sink,
        scope: buildChildScope(scope, name),
      }),
    error: makeLogFn('error', base, sink, scope),
    warn: makeLogFn('warn', base, sink, scope),
    info: makeLogFn('info', base, sink, scope),
    debug: makeLogFn('debug', base, sink, scope),
  };
}
