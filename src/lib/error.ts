import type { Logger } from './logger';
import { Err, type Result } from './result';

/**
 * Detailed information extracted from an error object.
 */
export type ErrorDetails = {
  /** The primary error message */
  message: string;
  /** Type of the error (e.g., 'object', 'string') */
  type: string;
  /** JSON representation of the error with all properties */
  json: string;
} & {
  /** Error name (e.g., 'TypeError', 'Error') */
  name?: string;
  /** Stack trace if available */
  stack?: string;
  /** Constructor name if available */
  constructor?: string;
};

/**
 * Sanitize an error object for JSON stringification by removing or truncating large properties
 */
function sanitizeErrorForJson(error: unknown): unknown {
  if (!error || typeof error !== 'object') {
    return error;
  }

  const errorObj = error as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};
  const MAX_PROPERTY_LENGTH = 200;

  // Properties to exclude entirely from serialization
  const excludeProps = new Set(['query', 'params']);

  for (const key of Object.getOwnPropertyNames(errorObj)) {
    if (excludeProps.has(key)) {
      continue; // Skip large properties that bloat logs
    }

    const value = errorObj[key];
    if (typeof value === 'string' && value.length > MAX_PROPERTY_LENGTH) {
      sanitized[key] = `${value.substring(0, MAX_PROPERTY_LENGTH)}... [truncated]`;
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Extracts comprehensive error details from any error object.
 * Handles Error instances, strings, and unknown error types.
 *
 * @param error - The error to extract details from
 * @param defaultMessage - Fallback message if no error message can be extracted
 * @returns Detailed error information
 */
export function extractErrorDetails(
  error: unknown,
  defaultMessage = 'Unknown error',
): ErrorDetails {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorString = error ? String(error) : '';

  // Sanitize the error object before stringifying to avoid massive logs
  const sanitizedError = sanitizeErrorForJson(error);
  const errorJson = sanitizedError ? JSON.stringify(sanitizedError) : 'null';

  // Use the first non-empty value as the message
  const message = errorMessage || errorString || errorJson || defaultMessage;

  const details = Object.create(null) as ErrorDetails;
  details.message = message;
  details.type = typeof error;
  details.json = errorJson;

  if (error instanceof Error) {
    if (error.name) details.name = error.name;
    if (error.stack) details.stack = error.stack;
  }

  if (error && typeof error === 'object' && 'constructor' in error) {
    const constructorName = (error.constructor as { name?: string })?.name;
    if (constructorName) {
      details.constructor = constructorName;
    }
  }

  return details;
}

/**
 * Truncates long strings in context to prevent excessive logging
 */
function truncateContext(context: Record<string, unknown>): Record<string, unknown> {
  const MAX_STRING_LENGTH = 200;
  const truncated: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(context)) {
    if (typeof value === 'string' && value.length > MAX_STRING_LENGTH) {
      truncated[key] =
        `${value.substring(0, MAX_STRING_LENGTH)}... [truncated, ${value.length} chars]`;
    } else {
      truncated[key] = value;
    }
  }

  return truncated;
}

/**
 * Logs an error with comprehensive details.
 *
 * @param logger - Logger instance to use
 * @param logMessage - Descriptive message for the log entry
 * @param error - The error to log
 * @param context - Additional context to include in the log
 */
export function logError(
  logger: Logger,
  logMessage: string,
  error: unknown,
  context?: Record<string, unknown>,
): void {
  const details = extractErrorDetails(error);
  const truncatedContext = context ? truncateContext(context) : {};

  logger.error(logMessage, {
    ...truncatedContext,
    error: details.message,
    errorName: details.name,
    errorStack: details.stack,
    errorType: details.type,
    errorConstructor: details.constructor,
    errorJson:
      details.json.length > 500 ? `${details.json.substring(0, 500)}... [truncated]` : details.json,
  });
}

/**
 * Logs an error with comprehensive details using warn level.
 *
 * @param logger - Logger instance to use
 * @param logMessage - Descriptive message for the log entry
 * @param error - The error to log
 * @param context - Additional context to include in the log
 */
export function logErrorAsWarn(
  logger: Logger,
  logMessage: string,
  error: unknown,
  context?: Record<string, unknown>,
): void {
  const details = extractErrorDetails(error);
  const truncatedContext = context ? truncateContext(context) : {};

  logger.warn(logMessage, {
    ...truncatedContext,
    error: details.message,
    errorName: details.name,
    errorStack: details.stack,
    errorType: details.type,
    errorConstructor: details.constructor,
    errorJson:
      details.json.length > 500 ? `${details.json.substring(0, 500)}... [truncated]` : details.json,
  });
}

/**
 * Handles an error by logging it and returning a Result Err.
 * This is a convenience function for use in catch blocks.
 *
 * @param error - The error to handle
 * @param options - Configuration options
 * @returns Result Err with the error message
 */
export function handleError<T = never>(
  error: unknown,
  options: {
    /** Logger instance to use for logging */
    logger: Logger;
    /** Descriptive message for the log entry */
    logMessage: string;
    /** Additional context to include in the log */
    context?: Record<string, unknown>;
    /** Fallback message if no error message can be extracted */
    defaultMessage?: string;
    /** Optional prefix to add to the error message in the Result */
    errorPrefix?: string;
  },
): Result<T, string> {
  const { logger, logMessage, context, defaultMessage = 'Unknown error', errorPrefix } = options;

  const details = extractErrorDetails(error, defaultMessage);
  logError(logger, logMessage, error, context);

  const finalMessage = errorPrefix ? `${errorPrefix}: ${details.message}` : details.message;
  return Err(finalMessage);
}

/**
 * Handles an error by logging it as a warning and returning a Result Err.
 * This is a convenience function for use in catch blocks where the error is expected.
 *
 * @param error - The error to handle
 * @param options - Configuration options
 * @returns Result Err with the error message
 */
export function handleErrorAsWarn<T = never>(
  error: unknown,
  options: {
    /** Logger instance to use for logging */
    logger: Logger;
    /** Descriptive message for the log entry */
    logMessage: string;
    /** Additional context to include in the log */
    context?: Record<string, unknown>;
    /** Fallback message if no error message can be extracted */
    defaultMessage?: string;
    /** Optional prefix to add to the error message in the Result */
    errorPrefix?: string;
  },
): Result<T, string> {
  const { logger, logMessage, context, defaultMessage = 'Unknown error', errorPrefix } = options;

  const details = extractErrorDetails(error, defaultMessage);
  logErrorAsWarn(logger, logMessage, error, context);

  const finalMessage = errorPrefix ? `${errorPrefix}: ${details.message}` : details.message;
  return Err(finalMessage);
}
