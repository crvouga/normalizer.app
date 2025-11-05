import { os } from '@orpc/server';

// Export procedure creator (os is the procedure builder)
export const procedure = os;

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
