import { createContext, type ReactNode } from 'react';
import { trpcClient } from '../shared/trpc-client';
import { User, type User as UserType } from './user';
import type { RemoteResult } from '../lib/result';
import { useEntityStore } from '../store/entity-store';
import { useLoader } from '../lib/use-loader';

type UserContextValue = {
  currentUserResult: RemoteResult<UserType, Error>;
  refetchCurrentUser: () => void;
};

const UserContext = createContext<UserContextValue | null>(null);

type UserProviderProps = {
  children: ReactNode;
};

export function UserProvider({ children }: UserProviderProps) {
  const { addEntity } = useEntityStore();
  const { state: currentUserResult, reload: refetchCurrentUser } = useLoader({
    loadData: async () => {
      const response = await trpcClient.users.currentUser.mutate();
      const currentUser = User.schema.parse(response);
      addEntity('users', currentUser);
      return currentUser;
    },
    deps: [],
  });
  return (
    <UserContext.Provider value={{ currentUserResult, refetchCurrentUser }}>
      {children}
    </UserContext.Provider>
  );
}

export { UserContext };
