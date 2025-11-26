export type TraceId = string & { readonly __brand: 'TraceId' };

const TRACE_ID_HEADER = 'X-Trace-Id';

/**
 * Generate a new trace ID with format: trace{8_random_hex_chars}
 * Example: trace1a2b3c4d
 */
export const generateTraceId = (): TraceId => {
  const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  return `trace${uuid}` as TraceId;
};

/**
 * Get trace ID from request headers, or generate a new one if not present
 */
export const getOrGenerateTraceId = (req: Request): TraceId => {
  const existingTraceId = req.headers.get(TRACE_ID_HEADER);
  return existingTraceId ? (existingTraceId as TraceId) : generateTraceId();
};

/**
 * Get trace ID from request headers (returns undefined if not present)
 */
export const getTraceId = (req: Request): TraceId | undefined => {
  const traceId = req.headers.get(TRACE_ID_HEADER);
  return traceId ? (traceId as TraceId) : undefined;
};

/**
 * Set trace ID header on a response
 */
export const setTraceIdHeader = (res: Response, traceId: TraceId): Response => {
  const newRes = new Response(res.body, res);
  newRes.headers.set(TRACE_ID_HEADER, traceId);
  return newRes;
};

/**
 * Set trace ID header on request headers object (for outgoing requests)
 */
export const setTraceIdOnHeaders = (headers: Headers, traceId: TraceId): void => {
  headers.set(TRACE_ID_HEADER, traceId);
};
