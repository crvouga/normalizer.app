import * as React from 'react';
import {
  Combobox as HeadlessCombobox,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  ComboboxButton,
} from '@headlessui/react';
import { cn } from '~/src/lib/utils';

// Icons
const IconChevronDown = React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(
  ({ className, ...props }, ref) => (
    <svg
      ref={ref}
      className={cn('h-4 w-4', className)}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      {...props}
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  ),
);

const IconCheck = React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(
  ({ className, ...props }, ref) => (
    <svg
      ref={ref}
      className={cn('h-4 w-4', className)}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      {...props}
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
);

const IconSpinner = React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(
  ({ className, ...props }, ref) => (
    <svg
      ref={ref}
      className={cn('h-4 w-4 animate-spin', className)}
      fill="none"
      viewBox="0 0 24 24"
      {...props}
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  ),
);

const IconAlertCircle = React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(
  ({ className, ...props }, ref) => (
    <svg
      ref={ref}
      className={cn('h-4 w-4', className)}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
);

// Types
export interface ComboboxOption<T> {
  value: T;
  label: string;
  disabled?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ComboboxFetchOptions {
  query: string;
  page: number;
  pageSize: number;
  signal?: AbortSignal;
}

export interface ComboboxFetchResult<T> {
  items: ComboboxOption<T>[];
  hasMore: boolean;
  total?: number;
}

export interface ComboboxProps<T> {
  // Value management
  value: T | null;
  onChange: (value: T | null) => void;
  
  // Data fetching
  fetchOptions: (options: ComboboxFetchOptions) => Promise<ComboboxFetchResult<T>>;
  
  // Customization
  placeholder?: string;
  displayValue?: (value: T | null) => string;
  filterOptions?: (options: ComboboxOption<T>[], query: string) => ComboboxOption<T>[];
  renderOption?: (option: ComboboxOption<T>, selected: boolean) => React.ReactNode;
  renderEmpty?: (query: string) => React.ReactNode;
  renderError?: (error: Error) => React.ReactNode;
  
  // Behavior
  debounceMs?: number;
  pageSize?: number;
  minQueryLength?: number;
  disabled?: boolean;
  
  // Styling
  className?: string;
  inputClassName?: string;
  optionsClassName?: string;
  
  // Labels
  label?: string;
  error?: string;
  helperText?: string;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function Combobox<T extends string | number>({
  value,
  onChange,
  fetchOptions,
  placeholder = 'Search...',
  displayValue,
  filterOptions,
  renderOption,
  renderEmpty,
  renderError,
  debounceMs = 300,
  pageSize = 20,
  minQueryLength = 0,
  disabled = false,
  className,
  inputClassName,
  optionsClassName,
  label,
  error,
  helperText,
}: ComboboxProps<T>) {
  // State
  const [query, setQuery] = React.useState('');
  const [options, setOptions] = React.useState<ComboboxOption<T>[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [fetchError, setFetchError] = React.useState<Error | null>(null);
  const [page, setPage] = React.useState(0);
  const [hasMore, setHasMore] = React.useState(true);
  const [total, setTotal] = React.useState<number | undefined>(undefined);

  const debouncedQuery = useDebounce(query, debounceMs);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const observerRef = React.useRef<IntersectionObserver | null>(null);
  const loadMoreRef = React.useRef<HTMLDivElement | null>(null);

  // Fetch function
  const fetchData = React.useCallback(
    async (searchQuery: string, pageNum: number, isLoadingMoreData = false) => {
      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Check min query length
      if (searchQuery.length < minQueryLength) {
        setOptions([]);
        setHasMore(false);
        setIsLoading(false);
        setIsLoadingMore(false);
        return;
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      try {
        if (isLoadingMoreData) {
          setIsLoadingMore(true);
        } else {
          setIsLoading(true);
        }
        setFetchError(null);

        const result = await fetchOptions({
          query: searchQuery,
          page: pageNum,
          pageSize,
          signal: abortControllerRef.current.signal,
        });

        if (isLoadingMoreData) {
          setOptions((prev) => [...prev, ...result.items]);
        } else {
          setOptions(result.items);
        }

        setHasMore(result.hasMore);
        setTotal(result.total);
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        setFetchError(err instanceof Error ? err : new Error('Failed to fetch options'));
        setOptions([]);
        setHasMore(false);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [fetchOptions, pageSize, minQueryLength],
  );

  // Effect to fetch data when query changes
  React.useEffect(() => {
    setPage(0);
    fetchData(debouncedQuery, 0, false);
  }, [debouncedQuery, fetchData]);

  // Intersection observer for infinite scroll
  React.useEffect(() => {
    if (!hasMore || isLoading || isLoadingMore) {
      return;
    }

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isLoading && !isLoadingMore) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchData(debouncedQuery, nextPage, true);
        }
      },
      { threshold: 0.1 },
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, isLoading, isLoadingMore, page, debouncedQuery, fetchData]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Display value function
  const getDisplayValue = React.useCallback(
    (val: T | null) => {
      if (val === null) return '';
      if (displayValue) return displayValue(val);
      
      const option = options.find((opt) => opt.value === val);
      return option?.label || String(val);
    },
    [displayValue, options],
  );

  // Filter options if provided
  const filteredOptions = React.useMemo(() => {
    if (filterOptions && query) {
      return filterOptions(options, query);
    }
    return options;
  }, [options, query, filterOptions]);

  // Render option content
  const renderOptionContent = React.useCallback(
    (option: ComboboxOption<T>, selected: boolean) => {
      if (renderOption) {
        return renderOption(option, selected);
      }

      return (
        <div className="flex items-center justify-between">
          <span className={cn('truncate', selected && 'font-semibold')}>{option.label}</span>
          {selected && <IconCheck className="text-blue-600" />}
        </div>
      );
    },
    [renderOption],
  );

  // Render empty state
  const renderEmptyState = React.useCallback(() => {
    if (renderEmpty) {
      return renderEmpty(query);
    }

    if (query.length < minQueryLength) {
      return (
        <div className="px-4 py-8 text-center text-sm text-gray-500">
          Type at least {minQueryLength} character{minQueryLength !== 1 ? 's' : ''} to search
        </div>
      );
    }

    return (
      <div className="px-4 py-8 text-center text-sm text-gray-500">
        {query ? `No results found for "${query}"` : 'No options available'}
      </div>
    );
  }, [renderEmpty, query, minQueryLength]);

  // Render error state
  const renderErrorState = React.useCallback(
    (err: Error) => {
      if (renderError) {
        return renderError(err);
      }

      return (
        <div className="flex items-center gap-2 px-4 py-8 text-sm text-red-600">
          <IconAlertCircle />
          <span>{err.message}</span>
        </div>
      );
    },
    [renderError],
  );

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label className="mb-2 block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      
      <HeadlessCombobox value={value} onChange={onChange} disabled={disabled}>
        <div className="relative">
          <div className="relative">
            <ComboboxInput
              className={cn(
                'w-full rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-10 text-sm leading-5 text-gray-900',
                'focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500',
                'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500',
                error && 'border-red-500 focus:border-red-500 focus:ring-red-500',
                inputClassName,
              )}
              displayValue={getDisplayValue}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={placeholder}
            />
            
            <ComboboxButton className="absolute inset-y-0 right-0 flex items-center pr-2">
              {isLoading ? (
                <IconSpinner className="text-gray-400" />
              ) : (
                <IconChevronDown className="text-gray-400" />
              )}
            </ComboboxButton>
          </div>

          <ComboboxOptions
            className={cn(
              'absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm',
              optionsClassName,
            )}
          >
            {fetchError ? (
              renderErrorState(fetchError)
            ) : filteredOptions.length === 0 && !isLoading ? (
              renderEmptyState()
            ) : (
              <>
                {filteredOptions.map((option) => (
                  <ComboboxOption
                    key={String(option.value)}
                    value={option.value}
                    disabled={option.disabled}
                    className={({ focus, selected }) =>
                      cn(
                        'relative cursor-pointer select-none py-2 pl-3 pr-9',
                        focus && 'bg-blue-50',
                        selected && 'bg-blue-100',
                        option.disabled && 'cursor-not-allowed opacity-50',
                      )
                    }
                  >
                    {({ selected }) => renderOptionContent(option, selected)}
                  </ComboboxOption>
                ))}
                
                {/* Infinite scroll trigger */}
                {hasMore && (
                  <div
                    ref={loadMoreRef}
                    className="relative cursor-default select-none py-2 pl-3 pr-9 text-center"
                  >
                    {isLoadingMore ? (
                      <div className="flex items-center justify-center gap-2 text-gray-500">
                        <IconSpinner />
                        <span className="text-xs">Loading more...</span>
                      </div>
                    ) : (
                      <div className="h-2" />
                    )}
                  </div>
                )}
              </>
            )}
          </ComboboxOptions>
        </div>
      </HeadlessCombobox>

      {/* Helper text or error message */}
      {(helperText || error) && (
        <p
          className={cn(
            'mt-1 text-xs',
            error ? 'text-red-600' : 'text-gray-500',
          )}
        >
          {error || helperText}
        </p>
      )}

      {/* Optional: Show total count */}
      {total !== undefined && !error && !isLoading && (
        <p className="mt-1 text-xs text-gray-500">
          {total} {total === 1 ? 'result' : 'results'}
        </p>
      )}
    </div>
  );
}

// Export a simpler version for common use cases
export interface SimpleComboboxProps<T> extends Omit<ComboboxProps<T>, 'fetchOptions'> {
  options: ComboboxOption<T>[];
  onSearch?: (query: string) => void;
}

export function SimpleCombobox<T extends string | number>({
  options: staticOptions,
  onSearch,
  ...props
}: SimpleComboboxProps<T>) {
  const fetchOptions = React.useCallback(
    async ({ query, page, pageSize }: ComboboxFetchOptions): Promise<ComboboxFetchResult<T>> => {
      // Filter options based on query
      const filtered = staticOptions.filter((option) =>
        option.label.toLowerCase().includes(query.toLowerCase()),
      );

      // Pagination
      const start = page * pageSize;
      const end = start + pageSize;
      const items = filtered.slice(start, end);
      const hasMore = end < filtered.length;

      // Call onSearch if provided
      if (onSearch) {
        onSearch(query);
      }

      return {
        items,
        hasMore,
        total: filtered.length,
      };
    },
    [staticOptions, onSearch],
  );

  return <Combobox {...props} fetchOptions={fetchOptions} />;
}

