import { toastStore } from './toast-store';
import type { ToastOptions } from './toast-types';

export { ToastProvider } from './toast-provider';

/**
 * Show a toast notification
 * @param message - The message to display
 * @param type - The type of toast ('success' or 'error')
 * @param options - Optional configuration (duration, dismissible, errorDetails)
 * @returns The ID of the created toast
 */
export function showToast(
  message: string,
  type: 'success' | 'error',
  options?: ToastOptions,
): string {
  return toastStore.addToast(type, message, options);
}

/**
 * Show a success toast notification
 * @param message - The message to display
 * @param options - Optional configuration (duration, dismissible)
 * @returns The ID of the created toast
 */
export function showSuccessToast(message: string, options?: ToastOptions): string {
  return toastStore.addToast('success', message, options);
}

/**
 * Show an error toast notification
 * @param message - The message to display
 * @param error - Optional error object to extract details from
 * @param options - Optional configuration (duration, dismissible)
 * @returns The ID of the created toast
 */
export function showErrorToast(
  message: string,
  error?: Error | unknown,
  options?: ToastOptions,
): string {
  let errorDetails: string | undefined;

  if (error) {
    if (error instanceof Error) {
      errorDetails = error.stack || error.message;
    } else if (typeof error === 'string') {
      errorDetails = error;
    } else {
      try {
        errorDetails = JSON.stringify(error, null, 2);
      } catch {
        errorDetails = String(error);
      }
    }
  }

  const finalErrorDetails = errorDetails || options?.errorDetails;
  return toastStore.addToast('error', message, {
    ...options,
    ...(finalErrorDetails ? { errorDetails: finalErrorDetails } : {}),
  });
}

/**
 * Remove a specific toast by ID
 * @param id - The ID of the toast to remove
 */
export function dismissToast(id: string): void {
  toastStore.removeToast(id);
}

/**
 * Clear all active toasts
 */
export function clearAllToasts(): void {
  toastStore.clearAll();
}
