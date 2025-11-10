import { useEffect, useState } from 'react';
import { trpcClient } from '../trpc-client';

type AuthEnabledState = { type: 'loading' } | { type: 'loaded'; isEnabled: boolean };

export function useGoogleAuthEnabled(): AuthEnabledState {
  const [state, setState] = useState<AuthEnabledState>({ type: 'loading' });

  useEffect(() => {
    trpcClient.auth.isEnabled
      .query()
      .then((result) => {
        setState({ type: 'loaded', isEnabled: result.enabled });
      })
      .catch(() => {
        setState({ type: 'loaded', isEnabled: false });
      });
  }, []);

  return state;
}
