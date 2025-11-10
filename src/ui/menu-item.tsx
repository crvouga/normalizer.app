import { type ReactNode } from 'react';
import { cn } from '~/src/lib/cn';

type MenuItemProps = {
  icon?: ReactNode;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
};

export function MenuItem({ icon, children, onClick, className }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700',
        className,
      )}
    >
      {icon && <div className="shrink-0">{icon}</div>}
      {children}
    </button>
  );
}
