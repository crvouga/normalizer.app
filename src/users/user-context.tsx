import { createContext, type ReactNode, useEffect, useState, useCallback } from 'react';
import { trpcClient } from '../trpc-client';
import { User, type User as UserType } from './user';
import type { RemoteResult } from '../lib/result';
import { Loading, Success, Failure } from '../lib/result';
import { useEntityStore } from '../store/entity-store';

type UserContextValue = {
  currentUserResult: RemoteResult<UserType, Error>;
  refetchCurrentUser: () => Promise<void>;
};

const UserContext = createContext<UserContextValue | null>(null);

type UserProviderProps = {
  children: ReactNode;
};

export function UserProvider({ children }: UserProviderProps) {
  const [currentUserResult, setCurrentUserResult] =
    useState<RemoteResult<UserType, Error>>(Loading);
  const { addEntity } = useEntityStore();

  const fetchCurrentUser = useCallback(async () => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setCurrentUserResult(Loading);
      const response = await trpcClient.users.currentUser.mutate();
      // Parse the response to ensure proper typing with branded types
      const currentUser = User.schema.parse(response);

      // Store user in entity store
      addEntity('users', currentUser);

      setCurrentUserResult(Success(currentUser));
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch user');
      setCurrentUserResult(Failure(error));
    }
  }, [addEntity]);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  return (
    <UserContext.Provider value={{ currentUserResult, refetchCurrentUser: fetchCurrentUser }}>
      {children}
    </UserContext.Provider>
  );
}

export { UserContext };
