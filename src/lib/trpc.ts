import { initTRPC } from '@trpc/server';
import { z } from 'zod';

// Create tRPC instance
const t = initTRPC.create();

// Export router, procedure, and middleware
export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;

// Create context type
export type Context = {
  // Add your context properties here
  // For example: user, db, etc.
};

// Create context function
export const createContext = (): Context => {
  return {
    // Initialize your context here
  };
};
