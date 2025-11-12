import * as React from 'react';

// Types
export interface ComboboxOption<T> {
  value: T;
  label: string;
  disabled?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ComboboxProps<T> {
  // Value management
  value: T | null;
  onChange: (value: T | null) => void;

  // Options
  options: ComboboxOption<T>[];

  // Query state (controlled)
  query?: string;
  onQueryChange?: (query: string) => void;

  // Customization
  placeholder?: string;
  displayValue?: (value: T | null) => string;
  filterOptions?: (options: ComboboxOption<T>[], query: string) => ComboboxOption<T>[];
  renderOption?: (option: ComboboxOption<T>, selected: boolean) => React.ReactNode;
  renderEmpty?: (query: string) => React.ReactNode;
  renderError?: (error: Error) => React.ReactNode;
  renderFooter?: () => React.ReactNode;

  // Loading state
  isLoading?: boolean;
  error?: Error | string | null;

  // Behavior
  disabled?: boolean;

  // Styling
  className?: string;
  inputClassName?: string;
  optionsClassName?: string;

  // Labels
  label?: string;
  helperText?: string;

  // Action button
  actionButton?: React.ReactNode;
}
