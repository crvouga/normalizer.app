import { procedure, router } from '../lib/trpc-server';
import { isGoogleAuthEnabled } from './google-oauth-config';

export const googleAuthRouter = router({
  /**
   * Check if Google authentication is enabled
   */
  isEnabled: procedure.query(() => {
    return { enabled: isGoogleAuthEnabled };
  }),
});
