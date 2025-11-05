import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { RouterClient } from '@orpc/server';
import type { AppRouter } from './orpc-server';

const link = new RPCLink({
  url: '/',
  headers: { Authorization: 'Bearer token' },
});

export const orpcClient: RouterClient<AppRouter> = createORPCClient(link);
