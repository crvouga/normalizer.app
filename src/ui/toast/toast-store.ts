import { Store } from '~/src/lib/store';
import type { Toast, ToastOptions, ToastType } from './toast-types';

interface ToastStoreState {
  toasts: Toast[];
}

class ToastStore extends Store<ToastStoreState> {
  constructor() {
    super({ toasts: [] });
  }

  addToast(type: ToastType, message: string, options?: ToastOptions): string {
    const id = crypto.randomUUID();
    const toast: Toast = {
      id,
      type,
      message,
      duration: options?.duration ?? (type === 'error' && options?.errorDetails ? 0 : 5000),
      dismissible: options?.dismissible ?? true,
      errorDetails: options?.errorDetails,
    };

    this.updateState((state) => ({
      toasts: [...state.toasts, toast],
    }));

    // Auto-dismiss if duration is set
    if (toast.duration && toast.duration > 0) {
      setTimeout(() => {
        this.removeToast(id);
      }, toast.duration);
    }

    return id;
  }

  removeToast(id: string): void {
    this.updateState((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }));
  }

  clearAll(): void {
    this.updateState((state) => ({ ...state, toasts: [] }));
  }
}

export const toastStore = new ToastStore();
