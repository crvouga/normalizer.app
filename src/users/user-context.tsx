import { createContext, type ReactNode, useEffect, useState } from 'react';
import { trpcClient } from '../trpc-client';
import { User, type User as UserType } from './user';
import type { RemoteResult } from '../lib/result';
import { Loading, Success, Failure } from '../lib/result';
import { useEntityStore } from '../store/entity-store';

type UserContextValue = {
  currentUserResult: RemoteResult<UserType, Error>;
};

const UserContext = createContext<UserContextValue | null>(null);

type UserProviderProps = {
  children: ReactNode;
};

export function UserProvider({ children }: UserProviderProps) {
  const [currentUserResult, setCurrentUserResult] =
    useState<RemoteResult<UserType, Error>>(Loading);
  const { addEntity } = useEntityStore();

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
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
    };

    fetchCurrentUser();
  }, [addEntity]);

  return <UserContext.Provider value={{ currentUserResult }}>{children}</UserContext.Provider>;
}

export { UserContext };
