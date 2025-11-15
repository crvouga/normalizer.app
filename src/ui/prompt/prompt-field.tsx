import * as React from 'react';
import type { I18nText } from '../../i18n/types';
import { Typography } from '../typography';
import { useI18n } from '../../i18n/use-i18n';

interface PromptInputFieldProps {
  id?: string;
  label?: I18nText;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: I18nText;
  rows?: number;
}

export const PromptInputField: React.FC<PromptInputFieldProps> = ({
  id = 'prompt',
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
}) => {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-2">
      <Typography
        as="label"
        weight="medium"
        color="primary"
        text={label ?? t('prompt.label')}
        {...({ htmlFor: id } as any)}
      />
      <textarea
        id={id}
        rows={rows}
        className="resize-y rounded border border-slate-300 bg-white p-2 text-base text-slate-900 focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-fuchsia-400 dark:focus:ring-fuchsia-400"
        placeholder={placeholder ?? t('prompt.placeholder')}
        value={value}
        onChange={onChange}
      />
    </div>
  );
};
