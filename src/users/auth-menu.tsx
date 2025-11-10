import { useEffect, useState } from 'react';
import { trpcClient } from '../trpc-client';
import type { User } from './user';

type AuthMenuProps = {
  user: User;
  onClose: () => void;
};

export function AuthMenu({ user, onClose }: AuthMenuProps) {
  const [isGoogleAuthEnabled, setIsGoogleAuthEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if Google auth is enabled
    trpcClient.auth.isEnabled
      .query()
      .then((result) => {
        setIsGoogleAuthEnabled(result.enabled);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, []);

  const handleGoogleSignIn = () => {
    // Redirect to Google OAuth
    window.location.href = '/api/auth/google';
  };

  const isAnonymous = user.type === 'anonymous';

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
      <div className="p-3">
        {isAnonymous && isGoogleAuthEnabled && !isLoading && (
          <button
            onClick={handleGoogleSignIn}
            className="flex w-full items-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-3 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:hover:bg-gray-800"
          >
            {/* Google Icon */}
            <svg className="h-5 w-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Sign in with Google
            </span>
          </button>
        )}

        {isAnonymous && !isGoogleAuthEnabled && !isLoading && (
          <div className="px-4 py-3 text-center text-xs text-gray-500 dark:text-gray-400">
            Authentication not configured
          </div>
        )}

        {!isAnonymous && (
          <div className="space-y-1">
            <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
              Signed in as {user.email || user.name}
            </div>
            {/* Future: Add sign out button here */}
          </div>
        )}

        {isLoading && (
          <div className="px-4 py-3 text-center">
            <div className="text-xs text-gray-500 dark:text-gray-400">Loading...</div>
          </div>
        )}
      </div>
    </div>
  );
}
