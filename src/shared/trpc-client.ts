import {
  createTRPCProxyClient,
  httpBatchLink,
  httpSubscriptionLink,
  splitLink,
} from '@trpc/client';
import type { AppRouter } from '../app-trpc-server';

export const trpcClient = createTRPCProxyClient<AppRouter>({
  links: [
    splitLink({
      condition: (op) => op.type === 'subscription',
      true: httpSubscriptionLink({
        url: '/api/trpc',
      }),
      false: httpBatchLink({
        url: '/api/trpc',
        headers: () => ({
          Authorization: 'Bearer token',
        }),
      }),
    }),
  ],
});
