export interface Logger {
  error: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
  debug: (message: string, meta?: Record<string, unknown>) => void;
}

const colors = {
  error: "\x1b[31m", // red
  warn: "\x1b[33m", // yellow
  info: "\x1b[36m", // cyan
  debug: "\x1b[90m", // gray
  reset: "\x1b[0m",
};

const formatMessage = (
  level: string,
  message: string,
  meta?: Record<string, unknown>
): string => {
  const timestamp = new Date().toISOString();
  const color = colors[level as keyof typeof colors];
  const formattedLevel = `${color}[${level.toUpperCase()}]${colors.reset}`;
  const baseMessage = `${timestamp} ${formattedLevel} ${message}`;

  if (!meta) return baseMessage;
  return `${baseMessage} ${JSON.stringify(meta)}`;
};

export const createLogger = (): Logger => ({
  error: (message: string, meta?: Record<string, unknown>) => {
    console.error(formatMessage("error", message, meta));
  },
  warn: (message: string, meta?: Record<string, unknown>) => {
    console.warn(formatMessage("warn", message, meta));
  },
  info: (message: string, meta?: Record<string, unknown>) => {
    console.info(formatMessage("info", message, meta));
  },
  debug: (message: string, meta?: Record<string, unknown>) => {
    console.debug(formatMessage("debug", message, meta));
  },
});
