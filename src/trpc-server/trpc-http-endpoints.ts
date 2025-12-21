import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '../app-trpc-server';
import type { Logger } from '../lib/logger';
import type { ObjectStore } from '../lib/object-store/object-store';
import { getOrGenerateTraceId, setTraceIdHeader } from '../lib/trace-id';
import type { Db } from '../shared/db';
import { SessionId } from '../shared/session-id';
import { getSessionId, setSessionCookie } from '../shared/session-id-cookie';
import { createContext } from '../shared/trpc-server';

type CreateTrpcEndpointsParams = {
  db: Db;
  objectStore: ObjectStore;
  logger: Logger;
};

export function createTrpcEndpoints({ db, objectStore, logger }: CreateTrpcEndpointsParams) {
  const trpcHandler = (method: 'GET' | 'POST') => async (req: Request) => {
    const traceId = getOrGenerateTraceId(req);
    const requestLogger = logger.child(traceId);
    requestLogger.info(`Received ${method} request`, { url: req.url });
    const res = await fetchRequestHandler({
      endpoint: '/api/trpc',
      req,
      router: appRouter,
      createContext: async () => {
        const context = await createContext({
          db,
          objectStore,
          logger: requestLogger,
          req,
        });
        return context;
      },
    });
    const existingSessionId = getSessionId(req);
    const sessionId = existingSessionId ?? SessionId.generate();
    const finalRes = setTraceIdHeader(setSessionCookie(req, res, sessionId), traceId);
    requestLogger.info(`Sent response`, {
      status: finalRes.status,
      statusText: finalRes.statusText,
    });
    return finalRes;
  };

  return {
    '/api/trpc/*': {
      GET: trpcHandler('GET'),
      POST: trpcHandler('POST'),
    },
  };
}
