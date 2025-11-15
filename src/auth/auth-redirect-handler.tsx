import { useEffect } from 'react';
import { showToast, showErrorToast } from '../ui/toast';
import { useI18n } from '../i18n/use-i18n';

/**
 * Handles authentication redirect callbacks by checking URL parameters
 * and displaying appropriate success/error messages.
 *
 * This component should be mounted once at the app root level.
 */
export function AuthRedirectHandler() {
  const { t } = useI18n();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authSuccess = params.get('auth_success');
    const authError = params.get('auth_error');

    if (authSuccess) {
      showToast(t('auth.signInSuccessGoogle'), 'success');
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (authError) {
      const errorKeyMap: Record<string, string> = {
        invalid_state: 'auth.errors.invalidState',
        missing_params: 'auth.errors.missingParams',
        not_configured: 'auth.errors.notConfigured',
        oauth_failed: 'auth.errors.oauthFailed',
        config_error: 'auth.errors.configError',
      };
      const errorKey = errorKeyMap[authError] || 'auth.errors.generic';
      showErrorToast(t(errorKey as any));
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [t]);

  return null;
}
