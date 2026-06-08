export interface Logger {
  child: (name: string) => Logger;
  error: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
  debug: (message: string, meta?: Record<string, unknown>) => void;
}

const colors = {
  error: '\x1b[31m', // red
  warn: '\x1b[33m', // yellow
  info: '\x1b[36m', // cyan
  debug: '\x1b[90m', // gray
  reset: '\x1b[0m',
};

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const parseLogLevel = (value: string | undefined): LogLevel => {
  if (value === 'error' || value === 'warn' || value === 'info' || value === 'debug') {
    return value;
  }
  return 'info';
};

const configuredLogLevel = parseLogLevel(process.env.LOG_LEVEL);

const shouldLog = (level: LogLevel): boolean => {
  return LOG_LEVEL_PRIORITY[level] <= LOG_LEVEL_PRIORITY[configuredLogLevel];
};

const toLogLevelDisplay = (level: LogLevel): string => {
  switch (level) {
    case 'error':
      return 'ERR';
    case 'warn':
      return 'WRN';
    case 'info':
      return 'INF';
    case 'debug':
      return 'DBG';
    default:
      return '???';
  }
};

const formatMessage = (
  level: LogLevel,
  name: string | undefined,
  message: string,
  meta?: Record<string, unknown>,
): string => {
  const timestamp = new Date().toISOString();
  const color = colors[level];
  const formattedLevel = `${color}[${toLogLevelDisplay(level)}]${colors.reset}`;
  const namePrefix = name ? `[${name}] ` : '';
  const baseMessage = `${timestamp} ${formattedLevel} ${namePrefix}${message}`;

  if (!meta) return baseMessage;
  return `${baseMessage} ${JSON.stringify(meta)}`;
};

const buildChildName = (parentName: string | undefined, childName: string): string => {
  return parentName ? `${parentName} ${childName}` : childName;
};

const buildNoopChildConfig = (
  parentName: string | undefined,
  childName: string,
): { noop: boolean; name: string } => {
  return {
    noop: true,
    name: buildChildName(parentName, childName),
  };
};

const buildChildConfig = (
  parentConfig: { noop?: boolean; name?: string } | undefined,
  childName: string,
): { noop?: boolean; name: string } => {
  return {
    ...(parentConfig?.noop !== undefined && { noop: parentConfig.noop }),
    name: buildChildName(parentConfig?.name, childName),
  };
};

const makeLogFn = (
  level: LogLevel,
  write: (message: string) => void,
  name: string | undefined,
) => {
  return (message: string, meta?: Record<string, unknown>) => {
    if (!shouldLog(level)) return;
    write(formatMessage(level, name, message, meta));
  };
};

export const createLogger = (config?: { noop?: boolean; name?: string }): Logger => {
  if (config?.noop) {
    return {
      error: () => {},
      warn: () => {},
      info: () => {},
      debug: () => {},
      child: (name: string) => createLogger(buildNoopChildConfig(config?.name, name)),
    };
  }
  return {
    child: (name: string) => createLogger(buildChildConfig(config, name)),
    error: makeLogFn('error', console.error, config?.name),
    warn: makeLogFn('warn', console.warn, config?.name),
    info: makeLogFn('info', console.info, config?.name),
    debug: makeLogFn('debug', console.debug, config?.name),
  };
};
