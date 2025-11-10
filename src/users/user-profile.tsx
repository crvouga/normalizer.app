import { useState } from 'react';
import type { User } from './user';
import { AuthMenu } from './auth-menu';

type UserProfileProps = {
  user: User;
};

export function UserProfile({ user }: UserProfileProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Generate initials from name or email
  const getInitials = () => {
    if (user.name) {
      return user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (user.email) {
      return user.email[0].toUpperCase();
    }
    return 'A'; // Anonymous
  };

  const isAnonymous = user.type === 'anonymous';

  return (
    <div className="relative">
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="flex w-full items-center gap-3 rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        {/* Avatar */}
        <div className="shrink-0">
          {user.profile_picture ? (
            <img
              src={user.profile_picture}
              alt={user.name || 'User'}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-600 font-medium text-white dark:bg-purple-500">
              {getInitials()}
            </div>
          )}
        </div>

        {/* User Info */}
        <div className="min-w-0 flex-1 text-left">
          <div className="truncate text-sm font-medium text-gray-900 dark:text-white">
            {user.name || user.email || 'Anonymous User'}
          </div>
          {isAnonymous ? (
            <div className="text-xs text-gray-500 dark:text-gray-400">Not signed in</div>
          ) : user.email ? (
            <div className="truncate text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
          ) : null}
        </div>
      </button>

      {/* Auth Menu */}
      {isMenuOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)} />

          {/* Menu */}
          <div className="absolute bottom-full left-0 z-20 mb-2 w-full">
            <AuthMenu user={user} onClose={() => setIsMenuOpen(false)} />
          </div>
        </>
      )}
    </div>
  );
}
