import type { ReactNode } from 'react';
import { MenuItems } from '@headlessui/react';
import { cn } from '~/src/lib/cn';

type AnimatedMenuItemsProps = {
  children: ReactNode;
  anchor?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
};

export function MenuItemsAnimated({
  children,
  anchor = 'bottom',
  className,
}: AnimatedMenuItemsProps) {
  return (
    <MenuItems
      anchor={anchor}
      transition
      className={cn(
        'py-2',
        'z-50 w-(--button-width) overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg focus:outline-none dark:border-slate-600 dark:bg-slate-700',
        // Animation classes
        'origin-top transition duration-200 ease-out',
        'data-closed:scale-95 data-closed:opacity-0',
        'data-open:scale-100 data-open:opacity-100',
        className,
      )}
    >
      {children}
    </MenuItems>
  );
}
