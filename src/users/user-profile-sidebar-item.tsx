import { Menu, MenuButton } from '@headlessui/react';
import { useState } from 'react';
import { SignOutConfirmationModal } from '~/src/auth/sign-out-confirmation-modal';
import { SignInModal } from '~/src/auth/sign-in-modal';
import { useGoogleAuthEnabled } from '~/src/auth/use-google-auth-enabled';
import { useSignOut } from '~/src/auth/use-sign-out';
import { useSignIn } from '~/src/auth/use-sign-in';
import { useI18n } from '~/src/i18n/use-i18n';
import { SettingsModal } from '~/src/settings/settings-modal';
import { MenuItemsAnimated } from '~/src/ui/menu-items-animated';
import { Avatar } from '~/src/ui/avatar';
import { Divider } from '~/src/ui/divider';
import { IconLogin, IconLogout, IconSettings, IconSpinner } from '~/src/ui/icons';
import { MenuItemButton } from '~/src/ui/menu-item-button';
import { Typography } from '~/src/ui/typography';
import type { User } from './user';
import { getUserInitials } from './user-initials';

type SettingsModalState = { type: 'closed' } | { type: 'open' };

type UserProfileSidebarItemProps = {
  user: User;
};

const UserMenuButton = ({ user, isAnonymous }: { user: User; isAnonymous: boolean }) => {
  return (
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
  );
};

export function UserProfileSidebarItem({ user }: UserProfileSidebarItemProps) {
  const [settingsModalState, setSettingsModalState] = useState<SettingsModalState>({
    type: 'closed',
  });
  const authState = useGoogleAuthEnabled();
  const { t } = useI18n();
  const {
    isOpen,
    isSigningOut: isLoggingOut,
    openSignOutDialog: openLogoutDialog,
    closeSignOutDialog: closeLogoutDialog,
    confirmSignOut: confirmLogout,
  } = useSignOut();
  const {
    isOpen: isSignInOpen,
    openSignInDialog,
    closeSignInDialog,
    handleGoogleSignIn,
  } = useSignIn();

  const isAnonymous = user.type === 'anonymous';

  const openSettings = () => setSettingsModalState({ type: 'open' });
  const closeSettings = () => setSettingsModalState({ type: 'closed' });

  return (
    <>
      <Menu as="div" className="relative w-full">
        <UserMenuButton user={user} isAnonymous={isAnonymous} />

        <MenuItemsAnimated anchor="top">
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

          {authState.type === 'loaded' && isAnonymous && authState.isEnabled && (
            <MenuItemButton
              onClick={openSignInDialog}
              icon={<IconLogin />}
              label={t('auth.signIn')}
            />
          )}

          <MenuItemButton onClick={openSettings} icon={<IconSettings />} label="Settings" />

          {!isAnonymous && (
            <MenuItemButton
              onClick={openLogoutDialog}
              icon={<IconLogout />}
              label={t('auth.signOut')}
            />
          )}
        </MenuItemsAnimated>
      </Menu>

      <SettingsModal isOpen={settingsModalState.type === 'open'} onClose={closeSettings} />

      <SignInModal
        isOpen={isSignInOpen}
        onClose={closeSignInDialog}
        onGoogleSignIn={handleGoogleSignIn}
      />

      <SignOutConfirmationModal
        isOpen={isOpen}
        onClose={closeLogoutDialog}
        onConfirm={confirmLogout}
        isLoggingOut={isLoggingOut}
      />
    </>
  );
}
