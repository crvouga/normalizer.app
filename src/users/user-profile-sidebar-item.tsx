import { useState } from 'react';
import type { User } from './user';
import { getUserInitials } from './user-initials';
import { Avatar } from '~/src/ui/avatar';
import { Typography } from '~/src/ui/typography';
import { Dropdown } from '~/src/ui/dropdown';
import { Divider } from '~/src/ui/divider';
import { MenuItem } from '~/src/ui/menu-item';
import { Button } from '~/src/ui/button';
import { IconSettings, IconSpinner, IconGoogle, IconLogout } from '~/src/ui/icons';
import { SettingsModal } from '~/src/settings/settings-modal';
import { useGoogleAuthEnabled } from '~/src/auth/use-google-auth-enabled';
import { trpcClient } from '~/src/trpc-client';
import { useI18n } from '~/src/i18n/use-i18n';

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
  const { t } = useI18n();

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

  const handleLogout = async () => {
    try {
      await trpcClient.users.logout.mutate();
      // Reload the page to refresh user context
      window.location.reload();
    } catch (error) {
      console.error('Logout failed:', error);
    }
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
              <Button
                variant="oauth"
                onClick={handleGoogleSignIn}
                startIcon={<IconGoogle className="size-5" />}
                text="Sign in with Google"
                className="w-full"
              />
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

          <Divider />

          <div className="p-2">
            <MenuItem
              icon={<IconSettings className="size-5 text-gray-600 dark:text-gray-400" />}
              onClick={openSettings}
            >
              <Typography variant="sm" color="secondary">
                Settings
              </Typography>
            </MenuItem>

            {!isAnonymous && (
              <MenuItem
                icon={<IconLogout className="size-5 text-gray-600 dark:text-gray-400" />}
                onClick={handleLogout}
              >
                <Typography variant="sm" color="secondary">
                  {t('auth.signOut')}
                </Typography>
              </MenuItem>
            )}
          </div>
        </Dropdown>
      </div>

      <SettingsModal isOpen={settingsModalState.type === 'open'} onClose={closeSettings} />
    </>
  );
}
