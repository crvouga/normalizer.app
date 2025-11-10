import { useSyncExternalStore, useState } from 'react';
import { toastStore } from './toast-store';
import { Toast } from './toast';
import { ToastErrorModal } from './toast-error-modal';

export function ToastContainer() {
  const toasts = useSyncExternalStore(toastStore.subscribe, () => toastStore.getState().toasts);

  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const handleShowError = (details: string) => {
    setErrorDetails(details);
  };

  const handleCloseErrorModal = () => {
    setErrorDetails(null);
  };

  return (
    <>
      {/* Toast container */}
      <div
        className="pointer-events-none fixed top-0 right-0 z-60 flex max-h-screen w-full flex-col items-end gap-2 overflow-hidden p-4"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onShowError={handleShowError} />
        ))}
      </div>

      {/* Error details modal */}
      <ToastErrorModal
        isOpen={errorDetails !== null}
        onClose={handleCloseErrorModal}
        errorDetails={errorDetails ?? ''}
      />
    </>
  );
}
