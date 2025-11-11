import type { ReactNode } from 'react';
import { MenuItems } from '@headlessui/react';
import { cn } from '~/src/lib/cn';
import { getSurfaceStyles } from '~/src/ui/surface';

type AnimatedMenuItemsProps = {
  children: ReactNode;
  anchor?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
};

/**
 * Surface styles for menu/dropdown containers.
 * Includes padding for menu items.
 */
function getMenuSurfaceStyles(className?: string) {
  return cn(getSurfaceStyles(), 'py-2', className);
}

export function MenuItemsAnimated({
  children,
  anchor = 'bottom',
  className,
}: AnimatedMenuItemsProps) {
  return (
    <MenuItems
      anchor={anchor}
      transition
      className={getMenuSurfaceStyles(
        cn(
          'w-(--button-width)',
          // Animation classes
          'origin-top transition duration-200 ease-out',
          'data-closed:scale-95 data-closed:opacity-0',
          'data-open:scale-100 data-open:opacity-100',
          className,
        ),
      )}
    >
      {children}
    </MenuItems>
  );
}
