import { Button } from './button';

export interface ModalActionsProps {
  // Cancel button
  cancelText: string;
  onCancel: () => void;
  cancelDisabled?: boolean;

  // Primary/Submit button
  submitText: string;
  onSubmit?: () => void;
  submitDisabled?: boolean;
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
      />
    </div>
  );
}
