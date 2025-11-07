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
      <label htmlFor={id} className="font-medium text-gray-900 dark:text-gray-100">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        className="resize-y rounded border border-gray-300 bg-white p-2 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-400"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
      />
    </div>
  );
};
