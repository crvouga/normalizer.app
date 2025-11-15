import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../app-trpc-server';

export const trpcClient = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: '/api/trpc',
      headers: () => ({
        Authorization: 'Bearer token',
      }),
    }),
  ],
});
