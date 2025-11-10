import { Transition } from '@headlessui/react';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { useI18n } from '~/src/i18n/use-i18n';
import { cn } from '~/src/lib/cn';
import { ButtonBase } from '../button-base';
import { IconAlertCircle, IconCheck, IconX } from '../icons';
import { toastStore } from './toast-store';
import type { Toast as ToastType } from './toast-types';

interface ToastProps {
  toast: ToastType;
  onShowError?: (errorDetails: string) => void;
}

export function Toast({ toast, onShowError }: ToastProps) {
  const { t } = useI18n();
  const [isVisible, setIsVisible] = useState(true);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    // Wait for animation to complete before removing from store
    setTimeout(() => {
      toastStore.removeToast(toast.id);
    }, 300);
  }, [toast.id]);

  // Auto-dismiss after duration
  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, toast.duration);

      return () => clearTimeout(timer);
    }
  }, [toast.duration, handleDismiss]);

  const handleShowError = () => {
    if (toast.errorDetails && onShowError) {
      onShowError(toast.errorDetails);
    }
  };

  const isSuccess = toast.type === 'success';
  const isError = toast.type === 'error';

  return (
    <Transition
      show={isVisible}
      as={Fragment}
      enter="transition-all duration-300"
      enterFrom="opacity-0 translate-x-full"
      enterTo="opacity-100 translate-x-0"
      leave="transition-all duration-300"
      leaveFrom="opacity-100 translate-x-0"
      leaveTo="opacity-0 translate-x-full"
    >
      <div
        className={cn(
          'pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg shadow-lg ring-1',
          'bg-white dark:bg-gray-800',
          isSuccess && 'ring-green-500/20 dark:ring-green-500/30',
          isError && 'ring-red-500/20 dark:ring-red-500/30',
        )}
      >
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="shrink-0">
              {isSuccess && (
                <div className="flex size-6 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <IconCheck className="size-4 text-green-600 dark:text-green-400" />
                </div>
              )}
              {isError && (
                <div className="flex size-6 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                  <IconAlertCircle className="size-4 text-red-600 dark:text-red-400" />
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 pt-0.5">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {toast.message}
              </p>

              {/* Error details button */}
              {isError && toast.errorDetails && (
                <ButtonBase
                  onClick={handleShowError}
                  className="mt-2 text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                >
                  {t('toast.seeError')}
                </ButtonBase>
              )}
            </div>

            {/* Dismiss button */}
            {toast.dismissible && (
              <ButtonBase
                onClick={handleDismiss}
                className="shrink-0 rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                aria-label={t('toast.dismiss')}
              >
                <IconX className="size-4" />
              </ButtonBase>
            )}
          </div>
        </div>
      </div>
    </Transition>
  );
}
