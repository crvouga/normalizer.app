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
  return parentName ? `${parentName}.${childName}` : childName;
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
    error: (message: string, meta?: Record<string, unknown>) => {
      console.error(formatMessage('error', config?.name, message, meta));
    },
    warn: (message: string, meta?: Record<string, unknown>) => {
      console.warn(formatMessage('warn', config?.name, message, meta));
    },
    info: (message: string, meta?: Record<string, unknown>) => {
      console.info(formatMessage('info', config?.name, message, meta));
    },
    debug: (message: string, meta?: Record<string, unknown>) => {
      console.debug(formatMessage('debug', config?.name, message, meta));
    },
  };
};
