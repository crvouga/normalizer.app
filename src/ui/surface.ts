import { cn } from '~/src/lib/cn';

/**
 * Base surface styles for dropdown menus, popovers, and other floating UI elements.
 * Provides consistent styling with shadow, rounded corners, and dark mode support.
 */
export function getSurfaceStyles(className?: string) {
  return cn(
    'z-50 overflow-hidden rounded-lg bg-white shadow-lg focus:outline-none',
    'dark:bg-slate-700',
    className,
  );
}
