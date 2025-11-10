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
      const errorMessages: Record<string, string> = {
        invalid_state: 'Authentication failed: Invalid state (possible CSRF attack)',
        missing_params: 'Authentication failed: Missing parameters',
        not_configured: 'Google authentication is not configured',
        oauth_failed: 'Authentication failed: Could not complete sign in',
        config_error: 'Authentication failed: Configuration error',
      };
      const message = errorMessages[authError] || 'Authentication failed';
      showErrorToast(message);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  return null;
}
