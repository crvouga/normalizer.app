import { type ReactNode } from 'react';
import { cn } from '~/src/lib/cn';

type DropdownPosition = 'top' | 'bottom';

type DropdownProps = {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  position?: DropdownPosition;
  className?: string;
};

export function Dropdown({
  isOpen,
  onClose,
  children,
  position = 'top',
  className,
}: DropdownProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-10" onClick={onClose} />

      {/* Dropdown Content */}
      <div
        className={cn(
          'absolute z-20 w-full',
          position === 'top' && 'bottom-full mb-2',
          position === 'bottom' && 'top-full mt-2',
          className,
        )}
      >
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
          {children}
        </div>
      </div>
    </>
  );
}
