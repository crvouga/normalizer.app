import { useState } from 'react';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import type { User } from './user';
import { getUserInitials } from './user-initials';
import { Avatar } from '~/src/ui/avatar';
import { Typography } from '~/src/ui/typography';
import { Divider } from '~/src/ui/divider';
import { IconSettings, IconSpinner, IconGoogle, IconLogout } from '~/src/ui/icons';
import { SettingsModal } from '~/src/settings/settings-modal';
import { useGoogleAuthEnabled } from '~/src/auth/use-google-auth-enabled';
import { useI18n } from '~/src/i18n/use-i18n';
import { useLogout } from '~/src/auth/use-logout';
import { LogoutConfirmationModal } from '~/src/auth/logout-confirmation-modal';

type SettingsModalState = { type: 'closed' } | { type: 'open' };

type UserProfileSidebarItemProps = {
  user: User;
};

export function UserProfileSidebarItem({ user }: UserProfileSidebarItemProps) {
  const [settingsModalState, setSettingsModalState] = useState<SettingsModalState>({
    type: 'closed',
  });
  const authState = useGoogleAuthEnabled();
  const { t } = useI18n();
  const { isOpen, isLoggingOut, openLogoutDialog, closeLogoutDialog, confirmLogout } = useLogout();

  const isAnonymous = user.type === 'anonymous';

  const openSettings = () => setSettingsModalState({ type: 'open' });
  const closeSettings = () => setSettingsModalState({ type: 'closed' });

  const handleGoogleSignIn = () => {
    window.location.href = '/api/auth/google';
  };

  return (
    <>
      <Menu as="div" className="relative w-full">
        <MenuButton className="flex w-full items-center gap-3 rounded-lg p-2 transition-all duration-200 hover:bg-gray-100 data-active:bg-gray-100 dark:hover:bg-gray-800 dark:data-active:bg-gray-800">
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
        </MenuButton>

        <MenuItems
          anchor="top"
          className="z-50 w-(--button-width) overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg focus:outline-none dark:border-gray-700 dark:bg-gray-800"
        >
          {authState.type === 'loading' && (
            <div className="flex items-center justify-center px-4 py-6">
              <IconSpinner className="size-5 text-gray-400" />
            </div>
          )}

          {authState.type === 'loaded' && !isAnonymous && (
            <div className="px-4 py-3">
              <Typography variant="xs" color="muted">
                Signed in as {user.email || user.name}
              </Typography>
            </div>
          )}

          {authState.type === 'loaded' && isAnonymous && !authState.isEnabled && (
            <div className="flex items-center justify-center px-4 py-6">
              <Typography variant="xs" color="muted">
                Authentication not configured
              </Typography>
            </div>
          )}

          <Divider />

          {/* Sign in with Google as a MenuItem rather than a Button */}
          {authState.type === 'loaded' && isAnonymous && authState.isEnabled && (
            <MenuItem>
              <button
                onClick={handleGoogleSignIn}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors data-focus:bg-gray-100 dark:data-focus:bg-gray-700"
                tabIndex={-1}
                type="button"
              >
                <IconGoogle className="size-5 shrink-0 text-gray-600 dark:text-gray-400" />
                <Typography variant="sm" color="secondary">
                  Sign in with Google
                </Typography>
              </button>
            </MenuItem>
          )}

          <MenuItem>
            {/* Settings button */}
            <button
              onClick={openSettings}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors data-focus:bg-gray-100 dark:data-focus:bg-gray-700"
              tabIndex={-1}
              type="button"
            >
              <IconSettings className="size-5 shrink-0 text-gray-600 dark:text-gray-400" />
              <Typography variant="sm" color="secondary">
                Settings
              </Typography>
            </button>
          </MenuItem>

          {!isAnonymous && (
            <MenuItem>
              <button
                onClick={openLogoutDialog}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors data-focus:bg-gray-100 dark:data-focus:bg-gray-700"
                tabIndex={-1}
                type="button"
              >
                <IconLogout className="size-5 shrink-0 text-gray-600 dark:text-gray-400" />
                <Typography variant="sm" color="secondary">
                  {t('auth.signOut')}
                </Typography>
              </button>
            </MenuItem>
          )}
        </MenuItems>
      </Menu>

      <SettingsModal isOpen={settingsModalState.type === 'open'} onClose={closeSettings} />
      <LogoutConfirmationModal
        isOpen={isOpen}
        onClose={closeLogoutDialog}
        onConfirm={confirmLogout}
        isLoggingOut={isLoggingOut}
      />
    </>
  );
}
