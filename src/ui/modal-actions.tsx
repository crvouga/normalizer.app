import type { I18nText } from '../i18n/types';
import { Button } from './button';

export interface ModalActionsProps {
  // Cancel button
  cancelText: I18nText;
  onCancel: () => void;
  cancelDisabled?: boolean;

  // Primary/Submit button
  submitText: I18nText;
  onSubmit?: () => void;
  submitDisabled?: boolean;
  submitLoading?: boolean;
  submitType?: 'submit' | 'button';

  // Layout
  className?: string;
}

/**
 * Standard modal action buttons layout with cancel and submit buttons.
 * Provides consistent styling and spacing for modal footer actions.
 */
export function ModalActions({
  cancelText,
  onCancel,
  cancelDisabled = false,
  submitText,
  onSubmit,
  submitDisabled = false,
  submitLoading = false,
  submitType = 'submit',
  className,
}: ModalActionsProps) {
  return (
    <div className={className ?? 'flex justify-end gap-3 pt-4'}>
      <Button
        type="button"
        variant="ghost"
        text={cancelText}
        onClick={onCancel}
        disabled={cancelDisabled}
      />
      <Button
        type={submitType}
        variant="default"
        text={submitText}
        onClick={onSubmit}
        disabled={submitDisabled}
        loading={submitLoading}
      />
    </div>
  );
}
