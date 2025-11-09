import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { Fragment } from 'react';
import { cn } from '~/src/lib/cn';
import { IconX } from './icons';
import { Typography } from './typography';
import { useI18n } from '../i18n/use-i18n';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
  className?: string;
}

// Make all modal sizes wider
const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-xl',
  xl: 'max-w-2xl',
  '2xl': 'max-w-3xl',
  '3xl': 'max-w-4xl',
  '4xl': 'max-w-5xl',
};

export function Modal({ isOpen, onClose, title, children, size = '4xl', className }: ModalProps) {
  const { t } = useI18n();

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        {/* Backdrop */}
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />
        </TransitionChild>

        {/* Full-screen container */}
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel
              className={cn(
                'w-full rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-800',
                sizeClasses[size],
                className,
              )}
            >
              {/* Header with title and close button */}
              {title && (
                <div className="mb-4 flex items-center justify-between">
                  <DialogTitle as="div">
                    <Typography as="h2" variant="lg" weight="semibold" color="primary">
                      {title}
                    </Typography>
                  </DialogTitle>
                  <button
                    onClick={onClose}
                    className="rounded p-1 text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                    aria-label={t('modal.close')}
                  >
                    <IconX className="size-5" />
                  </button>
                </div>
              )}

              {/* Content */}
              <Typography as="div" color="primary">
                {children}
              </Typography>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}
