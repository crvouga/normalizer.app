export type ToastType = 'success' | 'error';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  errorDetails?: string;
  duration?: number;
  dismissible?: boolean;
}

export interface ToastOptions {
  duration?: number;
  dismissible?: boolean;
  errorDetails?: string;
}
