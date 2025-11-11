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
      <div className="w-full px-0.5">
        <ButtonBase
          onClick={onClick}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-slate-50 data-disabled:opacity-50 data-focus:bg-slate-100 dark:hover:bg-slate-800 dark:data-focus:bg-slate-700"
          tabIndex={-1}
          type="button"
          disabled={disabled}
        >
          <div className="size-5 shrink-0 text-slate-600 dark:text-slate-400">{icon}</div>
          <Typography variant="sm" color="secondary">
            {label}
          </Typography>
        </ButtonBase>
      </div>
    </MenuItem>
  );
}
