import type { I18nText } from '../../i18n/types';

export type ToastType = 'success' | 'error';

export interface Toast {
  id: string;
  type: ToastType;
  message: I18nText;
  errorDetails?: string;
  duration?: number;
  dismissible?: boolean;
}

export interface ToastOptions {
  duration?: number;
  dismissible?: boolean;
  errorDetails?: string;
}
