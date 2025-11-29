import { Menu, MenuButton } from '@headlessui/react';
import { useState } from 'react';
import { SignOutConfirmationModal } from '~/src/auth/sign-out-confirmation-modal';
import { SignInModal } from '~/src/auth/sign-in-modal';
import { useGoogleAuthEnabled } from '~/src/auth/use-google-auth-enabled';
import { useSignOut } from '~/src/auth/use-sign-out';
import { useSignIn } from '~/src/auth/use-sign-in';
import { useI18n } from '~/src/i18n/use-i18n';
import { toI18nText } from '~/src/i18n/types';
import { cn } from '~/src/lib/cn';
import { SettingsModal } from '~/src/settings/settings-modal';
import { MenuItemsAnimated } from '~/src/ui/menu-items-animated';
import { Avatar } from '~/src/ui/avatar';
import { getButtonBaseStyles } from '~/src/ui/button-base';
import { Divider } from '~/src/ui/divider';
import { LogIn, LogOut, Settings, User as UserIcon } from 'lucide-react';
import { MenuItemButton } from '~/src/ui/menu-item-button';
import { Typography } from '~/src/ui/typography';
import type { User } from './user';
import { getUserInitials } from './user-initials';
import { Spinner } from '../ui/spinner';

type SettingsModalState = { type: 'closed' } | { type: 'open' };

type UserProfileSidebarItemProps = {
  user: User;
};

const UserMenuButton = ({ user, isAnonymous }: { user: User; isAnonymous: boolean }) => {
  return (
    <MenuButton
      className={cn(
        getButtonBaseStyles(),
        'flex w-full items-center gap-3 rounded-lg p-2 transition-all duration-200',
        'hover:bg-slate-100 data-active:bg-slate-100',
        'dark:hover:bg-slate-800 dark:data-active:bg-slate-800',
      )}
    >
      {isAnonymous ? (
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700">
          <UserIcon className="size-5 text-slate-600 dark:text-slate-400" />
        </div>
      ) : (
        <Avatar
          {...(user.profile_picture ? { src: user.profile_picture } : {})}
          alt={user.name || 'User'}
          initials={getUserInitials(user)}
          size="md"
        />
      )}
      <div className="min-w-0 flex-1 text-left">
        <Typography
          variant="sm"
          weight="medium"
          color="primary"
          className="truncate"
          text={toI18nText(user.name || user.email || 'Anonymous User')}
        />
        {isAnonymous ? (
          <Typography variant="xs" color="muted" text={toI18nText('Not signed in')} />
        ) : user.email ? (
          <Typography
            variant="xs"
            color="muted"
            className="truncate"
            text={toI18nText(user.email)}
          />
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
              <Spinner size="sm" />
            </div>
          )}

          {authState.type === 'loaded' && !isAnonymous && (
            <div className="px-4 py-3">
              <Typography
                variant="xs"
                color="muted"
                text={toI18nText(`Signed in as ${user.email || user.name}`)}
              />
            </div>
          )}

          {authState.type === 'loaded' && isAnonymous && !authState.isEnabled && (
            <div className="flex items-center justify-center px-4 py-6">
              <Typography
                variant="xs"
                color="muted"
                text={toI18nText('Authentication not configured')}
              />
            </div>
          )}

          <Divider />

          {authState.type === 'loaded' && isAnonymous && authState.isEnabled && (
            <MenuItemButton onClick={openSignInDialog} icon={<LogIn />} label={t('auth.signIn')} />
          )}

          <MenuItemButton onClick={openSettings} icon={<Settings />} label={t('settings.title')} />

          {!isAnonymous && (
            <MenuItemButton
              onClick={openLogoutDialog}
              icon={<LogOut />}
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
