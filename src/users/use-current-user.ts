import { useContext } from 'react';
import { UserContext } from './user-context';
import type { RemoteResult } from '../lib/result';
import type { User } from './user';

export function useCurrentUser(): RemoteResult<User, Error> {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useCurrentUser must be used within a UserProvider');
  }
  return context.currentUserResult;
}
