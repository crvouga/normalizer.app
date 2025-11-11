import { useContext } from 'react';
import { UserContext } from './user-context';
import type { RemoteResult } from '../lib/result';
import type { User } from './user';

export function useCurrentUserResult(): {
  currentUserResult: RemoteResult<User, Error>;
  refetchCurrentUser: () => Promise<void>;
} {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useCurrentUser must be used within a UserProvider');
  }
  return context;
}

export function useCurrentUser(): User {
  const { currentUserResult } = useCurrentUserResult();
  switch (currentUserResult.tag) {
    case 'ok':
      return currentUserResult.value;
    case 'err':
      throw currentUserResult.error;
    case 'loading':
      throw new Error('User is loading');
    case 'notAsked':
      throw new Error('User is not asked');
  }
}
