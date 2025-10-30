import * as React from 'react';

interface PromptInputFieldProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
}

export const PromptInputField: React.FC<PromptInputFieldProps> = ({
  id = 'prompt',
  label = 'Prompt',
  value,
  onChange,
  placeholder = 'Enter your prompt here...',
  rows = 4,
}) => {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        className="resize-y rounded border p-2"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
      />
    </div>
  );
};
