import type { ReactNode } from 'react';
import { MenuItem } from '@headlessui/react';
import { Typography } from './typography';
import { ButtonBase } from './button-base';

type MenuItemButtonProps = {
  onClick: () => void;
  icon: ReactNode;
  label: string;
  disabled?: boolean;
};

export function MenuItemButton({ onClick, icon, label, disabled = false }: MenuItemButtonProps) {
  return (
    <MenuItem disabled={disabled}>
      <ButtonBase
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors data-disabled:opacity-50 data-focus:bg-gray-100 dark:data-focus:bg-gray-700"
        tabIndex={-1}
        type="button"
        disabled={disabled}
      >
        <div className="size-5 shrink-0 text-gray-600 dark:text-gray-400">{icon}</div>
        <Typography variant="sm" color="secondary">
          {label}
        </Typography>
      </ButtonBase>
    </MenuItem>
  );
}
