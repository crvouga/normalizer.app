import type { ReactNode } from 'react';
import { useEffect } from 'react';
import type { CurrentScreen } from '../screen/current-screen';
import { Typography } from '../ui/typography';
import { Spinner } from '../ui/spinner';

export interface PermissionGuardProps {
  /**
   * Check if permission is granted
   */
  hasPermission: boolean;
  /**
   * Loading state while checking permissions
   */
  isLoading: boolean;
  /**
   * Error that occurred during permission check
   */
  error?: Error | null;
  /**
   * Screen to redirect to if permission is denied
   */
  fallbackScreen: CurrentScreen;
  /**
   * Function to navigate to a screen
   */
  onRedirect: (screen: CurrentScreen) => void;
  /**
   * Content to render if permission is granted
   */
  children: ReactNode;
  /**
   * Optional custom loading component
   */
  loadingComponent?: ReactNode;
  /**
   * Optional custom error component
   */
  errorComponent?: ReactNode;
}

interface AccessDeniedRedirectProps {
  fallbackScreen: CurrentScreen;
  onRedirect: (screen: CurrentScreen) => void;
}

/**
 * Component that handles redirect when access is denied
 */
function AccessDeniedRedirect({ fallbackScreen, onRedirect }: AccessDeniedRedirectProps) {
  useEffect(() => {
    onRedirect(fallbackScreen);
  }, [fallbackScreen, onRedirect]);

  return (
    <div className="flex h-full w-full items-center justify-center">
      <Typography color="muted" variant="lg">
        Access denied. Redirecting...
      </Typography>
    </div>
  );
}

/**
 * PermissionGuard component that checks permissions and redirects if denied
 */
export function PermissionGuard({
  hasPermission,
  isLoading,
  error,
  fallbackScreen,
  onRedirect,
  children,
  loadingComponent,
  errorComponent,
}: PermissionGuardProps) {
  // Show loading state while checking permissions
  if (isLoading) {
    return (
      loadingComponent || (
        <div className="flex h-full w-full items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Spinner size="md" color="fuchsia" />
            <Typography color="muted" variant="lg">
              Checking permissions...
            </Typography>
          </div>
        </div>
      )
    );
  }

  // Handle error state
  if (error) {
    return (
      errorComponent || (
        <div className="flex h-full w-full items-center justify-center">
          <div className="flex flex-col gap-4 text-center">
            <Typography color="error" variant="lg">
              Error checking permissions
            </Typography>
            <Typography color="muted" variant="sm">
              {error.message}
            </Typography>
          </div>
        </div>
      )
    );
  }

  // Redirect if permission is denied
  if (!hasPermission) {
    return <AccessDeniedRedirect fallbackScreen={fallbackScreen} onRedirect={onRedirect} />;
  }

  // Render children if permission is granted
  return <>{children}</>;
}
