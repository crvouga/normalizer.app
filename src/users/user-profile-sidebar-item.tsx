import { useState } from 'react';
import type { User } from './user';
import { getUserInitials } from './user-initials';
import { Avatar } from '~/src/ui/avatar';
import { Typography } from '~/src/ui/typography';
import { Dropdown } from '~/src/ui/dropdown';
import { IconSettings, IconSpinner, IconGoogle } from '~/src/ui/icons';
import { SettingsModal } from '~/src/settings/settings-modal';
import { useGoogleAuthEnabled } from '~/src/auth/use-google-auth-enabled';

type MenuState = { type: 'closed' } | { type: 'open' };

type SettingsModalState = { type: 'closed' } | { type: 'open' };

type UserProfileSidebarItemProps = {
  user: User;
};

export function UserProfileSidebarItem({ user }: UserProfileSidebarItemProps) {
  const [menuState, setMenuState] = useState<MenuState>({ type: 'closed' });
  const [settingsModalState, setSettingsModalState] = useState<SettingsModalState>({
    type: 'closed',
  });
  const authState = useGoogleAuthEnabled();

  const isAnonymous = user.type === 'anonymous';

  const toggleMenu = () => {
    setMenuState((prev) => (prev.type === 'closed' ? { type: 'open' } : { type: 'closed' }));
  };

  const closeMenu = () => {
    setMenuState({ type: 'closed' });
  };

  const openSettings = () => {
    setSettingsModalState({ type: 'open' });
    closeMenu();
  };

  const closeSettings = () => {
    setSettingsModalState({ type: 'closed' });
  };

  const handleGoogleSignIn = () => {
    window.location.href = '/api/auth/google';
  };

  return (
    <>
      <div className="relative w-full">
        <button
          onClick={toggleMenu}
          className="flex w-full items-center gap-3 rounded-lg p-2 transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <Avatar
            src={user.profile_picture}
            alt={user.name || 'User'}
            initials={getUserInitials(user)}
            size="md"
          />
          <div className="min-w-0 flex-1 text-left">
            <Typography variant="sm" weight="medium" color="primary" className="truncate">
              {user.name || user.email || 'Anonymous User'}
            </Typography>
            {isAnonymous ? (
              <Typography variant="xs" color="muted">
                Not signed in
              </Typography>
            ) : user.email ? (
              <Typography variant="xs" color="muted" className="truncate">
                {user.email}
              </Typography>
            ) : null}
          </div>
        </button>

        <Dropdown isOpen={menuState.type === 'open'} onClose={closeMenu} position="top">
          {/* Auth Section - Fixed height to prevent layout shift */}
          <div className="min-h-[80px] p-3">
            {authState.type === 'loading' && (
              <div className="flex items-center justify-center py-6">
                <IconSpinner className="size-5 text-gray-400" />
              </div>
            )}

            {authState.type === 'loaded' && isAnonymous && authState.isEnabled && (
              <button
                onClick={handleGoogleSignIn}
                className="flex w-full items-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-3 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:hover:bg-gray-800"
              >
                <IconGoogle className="size-5 shrink-0" />
                <Typography variant="sm" weight="medium" color="secondary">
                  Sign in with Google
                </Typography>
              </button>
            )}

            {authState.type === 'loaded' && isAnonymous && !authState.isEnabled && (
              <div className="flex items-center justify-center py-6">
                <Typography variant="xs" color="muted">
                  Authentication not configured
                </Typography>
              </div>
            )}

            {authState.type === 'loaded' && !isAnonymous && (
              <div className="py-3">
                <Typography variant="xs" color="muted" className="px-4">
                  Signed in as {user.email || user.name}
                </Typography>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 dark:border-gray-700" />

          {/* Settings Menu Item */}
          <div className="p-2">
            <button
              onClick={openSettings}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <IconSettings className="size-5 shrink-0 text-gray-600 dark:text-gray-400" />
              <Typography variant="sm" color="secondary">
                Settings
              </Typography>
            </button>
          </div>
        </Dropdown>
      </div>

      <SettingsModal isOpen={settingsModalState.type === 'open'} onClose={closeSettings} />
    </>
  );
}
