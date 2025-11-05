import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { RouterClient } from '@orpc/server';
import type { AppRouter } from './orpc-server';

const link = new RPCLink({
  url: 'http://127.0.0.1:3000',
  headers: { Authorization: 'Bearer token' },
});

export const orpcClient: RouterClient<AppRouter> = createORPCClient(link);
