import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from './trpc-app-router';

export const trpcReactClient = createTRPCReact<AppRouter>({});

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: '/api/trpc/',
    }),
  ],
});
