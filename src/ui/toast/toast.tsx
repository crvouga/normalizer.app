import { Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { useI18n } from '~/src/i18n/use-i18n';
import type { I18nText } from '../../i18n/types';
import { cn } from '~/src/lib/cn';
import { ButtonBase } from '../button-base';
import { AlertCircle, Check, X } from 'lucide-react';
import type { Toast as ToastType } from './toast-types';

interface ToastProps {
  toast: ToastType;
  isVisible: boolean;
  onDismiss: () => void;
  onShowError?: (errorDetails: string) => void;
}

function ToastIcon({ type }: { type: 'success' | 'error' }) {
  if (type === 'success') {
    return (
      <div className="flex size-6 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
        <Check className="size-4 text-green-600 dark:text-green-400" />
      </div>
    );
  }

  return (
    <div className="flex size-6 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
      <AlertCircle className="size-4 text-red-600 dark:text-red-400" />
    </div>
  );
}

function ToastContent({
  message,
  errorDetails,
  onShowError,
}: {
  message: I18nText;
  errorDetails?: string;
  onShowError?: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="flex-1 pt-0.5">
      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{message}</p>

      {errorDetails && onShowError && (
        <ButtonBase
          onClick={onShowError}
          className="mt-2 text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
        >
          {t('toast.seeError')}
        </ButtonBase>
      )}
    </div>
  );
}

export function Toast({ toast, isVisible, onDismiss, onShowError }: ToastProps) {
  const { t } = useI18n();
  const isSuccess = toast.type === 'success';
  const isError = toast.type === 'error';

  const handleShowError = () => {
    if (toast.errorDetails && onShowError) {
      onShowError(toast.errorDetails);
    }
  };

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
          'bg-white dark:bg-slate-800',
          isSuccess && 'ring-green-500/20 dark:ring-green-500/30',
          isError && 'ring-red-500/20 dark:ring-red-500/30',
        )}
      >
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0">
              <ToastIcon type={toast.type} />
            </div>

            <ToastContent
              message={toast.message}
              {...(toast.errorDetails ? { errorDetails: toast.errorDetails } : {})}
              {...(toast.errorDetails ? { onShowError: handleShowError } : {})}
            />

            {toast.dismissible && (
              <ButtonBase
                onClick={onDismiss}
                className="shrink-0 rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                aria-label={t('toast.dismiss')}
              >
                <X className="size-4" />
              </ButtonBase>
            )}
          </div>
        </div>
      </div>
    </Transition>
  );
}
