import * as React from 'react';
import { Copy } from 'lucide-react';
import type { I18nText } from '../../i18n/types';
import { useI18n } from '../../i18n/use-i18n';
import { ButtonBase } from '../button-base';
import { showSuccessToast } from '../toast';

export interface CopyToClipboardButtonProps {
  /**
   * Text to copy to clipboard, or a function that returns the text to copy
   */
  text: string | (() => string | Promise<string>);
  /**
   * Custom className for the button
   */
  className?: string;
  /**
   * Custom aria-label (string for HTML attribute)
   */
  ariaLabel?: string;
  /**
   * Custom title/tooltip (string for HTML attribute)
   */
  title?: string;
  /**
   * Whether the button is disabled
   */
  disabled?: boolean;
  /**
   * Success message to show after copying (defaults to "Copied to clipboard")
   */
  successMessage?: I18nText;
}

/**
 * Generic button component that copies text to clipboard
 */
export const CopyToClipboardButton: React.FC<CopyToClipboardButtonProps> = ({
  text,
  className,
  ariaLabel,
  title,
  disabled = false,
  successMessage,
}) => {
  const { t } = useI18n();
  const [isCopying, setIsCopying] = React.useState(false);

  const handleCopyToClipboard = React.useCallback(async () => {
    setIsCopying(true);
    try {
      const textToCopy = typeof text === 'function' ? await text() : text;
      await navigator.clipboard.writeText(textToCopy);
      showSuccessToast(successMessage ?? t('copyToClipboard.success'));
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      showSuccessToast(t('copyToClipboard.error'));
    } finally {
      setIsCopying(false);
    }
  }, [text, successMessage, t]);

  const defaultAriaLabel = ariaLabel ?? String(t('copyToClipboard.label'));
  const defaultTitle = title ?? String(t('copyToClipboard.label'));

  return (
    <ButtonBase
      onClick={handleCopyToClipboard}
      disabled={disabled || isCopying}
      busy={isCopying}
      className={className}
      aria-label={defaultAriaLabel}
      title={defaultTitle}
    >
      <Copy className="size-4" />
    </ButtonBase>
  );
};
