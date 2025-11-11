import { useSyncExternalStore, useState, useEffect, useCallback } from 'react';
import { toastStore } from './toast-store';
import { Toast } from './toast';
import { ToastErrorModal } from './toast-error-modal';

const ANIMATION_DURATION = 300;

export function ToastContainer() {
  const toasts = useSyncExternalStore(toastStore.subscribe, () => toastStore.getState().toasts);

  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const currentToast = toasts[0];
  const hasQueuedToasts = toasts.length > 1;

  // Handle dismissal with animation
  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => {
      if (currentToast) {
        toastStore.removeToast(currentToast.id);
      }
    }, ANIMATION_DURATION);
  }, [currentToast]);

  // Trigger enter animation when a new toast appears
  useEffect(() => {
    if (currentToast) {
      const timer = requestAnimationFrame(() => {
        setIsVisible(true);
      });
      return () => cancelAnimationFrame(timer);
    } else {
      setIsVisible(false);
    }
  }, [currentToast?.id]);

  // Auto-dismiss after duration
  useEffect(() => {
    if (currentToast?.duration && currentToast.duration > 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, currentToast.duration);

      return () => clearTimeout(timer);
    }
  }, [currentToast?.id, currentToast?.duration, handleDismiss]);

  // Immediately dismiss when new toasts are queued
  useEffect(() => {
    if (hasQueuedToasts && isVisible) {
      handleDismiss();
    }
  }, [hasQueuedToasts, isVisible, handleDismiss]);

  const handleShowError = (details: string) => {
    setErrorDetails(details);
  };

  const handleCloseErrorModal = () => {
    setErrorDetails(null);
  };

  return (
    <>
      <div
        className="pointer-events-none fixed top-0 right-0 z-60 flex max-h-screen w-full flex-col items-end gap-2 overflow-hidden p-4"
        aria-live="polite"
        aria-atomic="false"
      >
        {currentToast && (
          <Toast
            key={currentToast.id}
            toast={currentToast}
            isVisible={isVisible}
            onDismiss={handleDismiss}
            onShowError={handleShowError}
          />
        )}
      </div>

      <ToastErrorModal
        isOpen={errorDetails !== null}
        onClose={handleCloseErrorModal}
        errorDetails={errorDetails ?? ''}
      />
    </>
  );
}
