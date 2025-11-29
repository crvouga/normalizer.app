# Combobox Component

A fully-featured, generic combobox component built on top of Headless UI that handles loading states, async fetching, error handling, and infinite scroll out of the box.

## Features

- ✅ **Generic & Type-Safe** - Works with any data type (`string`, `number`, or custom types)
- ✅ **Async Data Fetching** - Built-in support for API calls with abort controllers
- ✅ **Loading States** - Automatic loading indicators for initial load and pagination
- ✅ **Error Handling** - Customizable error states with retry capabilities
- ✅ **Infinite Scroll** - Seamless pagination as users scroll through options
- ✅ **Debounced Search** - Configurable debounce to reduce API calls
- ✅ **Keyboard Navigation** - Full keyboard support via Headless UI
- ✅ **Custom Rendering** - Fully customizable option and empty state rendering
- ✅ **Request Cancellation** - Automatic abort of pending requests
- ✅ **Min Query Length** - Set minimum characters before searching
- ✅ **Accessibility** - Built on Headless UI with ARIA support

## Installation

The component is already included in your project at `src/ui/combobox.tsx`.

Required dependencies (already installed):
- `@headlessui/react`
- `react`

## Basic Usage

### Simple Static Data

```tsx
import { SimpleCombobox, type ComboboxOption } from '~/src/ui/combobox';

function MyComponent() {
  const [value, setValue] = React.useState<string | null>(null);

  const options: ComboboxOption<string>[] = [
    { value: 'apple', label: 'Apple' },
    { value: 'banana', label: 'Banana' },
    { value: 'cherry', label: 'Cherry' },
  ];

  return (
    <SimpleCombobox
      value={value}
      onChange={setValue}
      options={options}
      placeholder="Select a fruit..."
      label="Favorite Fruit"
    />
  );
}
```

### Async Data Fetching

```tsx
import { Combobox, type ComboboxFetchOptions, type ComboboxFetchResult } from '~/src/ui/combobox';

function UserSelector() {
  const [userId, setUserId] = React.useState<number | null>(null);

  const fetchUsers = async ({ query, page, pageSize, signal }: ComboboxFetchOptions) => {
    const response = await fetch(
      `https://api.example.com/users?q=${query}&page=${page}&limit=${pageSize}`,
      { signal }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch users');
    }

    const data = await response.json();

    return {
      items: data.users.map(user => ({
        value: user.id,
        label: user.name,
        metadata: { email: user.email }
      })),
      hasMore: data.hasMore,
      total: data.total,
    };
  };

  return (
    <Combobox
      value={userId}
      onChange={setUserId}
      fetchOptions={fetchUsers}
      placeholder="Search users..."
      label="Select User"
      debounceMs={500}
    />
  );
}
```

## API Reference

### `Combobox` Props

#### Value Management

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `value` | `T \| null` | Yes | Currently selected value |
| `onChange` | `(value: T \| null) => void` | Yes | Callback when selection changes |

#### Data Fetching

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `fetchOptions` | `(options: ComboboxFetchOptions) => Promise<ComboboxFetchResult<T>>` | Yes | Async function to fetch options |

**ComboboxFetchOptions:**
```typescript
{
  query: string;        // Search query
  page: number;         // Current page (0-indexed)
  pageSize: number;     // Items per page
  signal?: AbortSignal; // Abort controller signal
}
```

**ComboboxFetchResult:**
```typescript
{
  items: ComboboxOption<T>[];  // Options to display
  hasMore: boolean;            // Whether more pages exist
  total?: number;              // Optional total count
}
```

**ComboboxOption:**
```typescript
{
  value: T;                           // Unique value
  label: string;                      // Display text
  disabled?: boolean;                 // Disable selection
  metadata?: Record<string, unknown>; // Extra data for rendering
}
```

#### Customization

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `placeholder` | `string` | `"Search..."` | Input placeholder text |
| `displayValue` | `(value: T \| null) => string` | Shows label | Custom display in input |
| `filterOptions` | `(options: ComboboxOption<T>[], query: string) => ComboboxOption<T>[]` | None | Client-side filtering |
| `renderOption` | `(option: ComboboxOption<T>, selected: boolean) => ReactNode` | Default | Custom option rendering |
| `renderEmpty` | `(query: string) => ReactNode` | Default | Custom empty state |
| `renderError` | `(error: Error) => ReactNode` | Default | Custom error state |

#### Behavior

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `debounceMs` | `number` | `300` | Debounce delay for search |
| `pageSize` | `number` | `20` | Items per page |
| `minQueryLength` | `number` | `0` | Min chars before searching |
| `disabled` | `boolean` | `false` | Disable the combobox |

#### Styling

| Prop | Type | Description |
|------|------|-------------|
| `className` | `string` | Container class |
| `inputClassName` | `string` | Input field class |
| `optionsClassName` | `string` | Dropdown class |

#### Labels

| Prop | Type | Description |
|------|------|-------------|
| `label` | `string` | Label above input |
| `error` | `string` | Error message below |
| `helperText` | `string` | Helper text below |

### `SimpleCombobox` Props

A simplified version for static data that doesn't require pagination:

```typescript
interface SimpleComboboxProps<T> extends Omit<ComboboxProps<T>, 'fetchOptions'> {
  options: ComboboxOption<T>[];
  onSearch?: (query: string) => void;
}
```

## Advanced Examples

### Custom Option Rendering

```tsx
const renderOption = (option: ComboboxOption<string>, selected: boolean) => (
  <div className="flex items-center justify-between">
    <div className="flex flex-col">
      <span className={selected ? 'font-semibold' : ''}>{option.label}</span>
      {option.metadata?.email && (
        <span className="text-xs text-gray-500">{option.metadata.email}</span>
      )}
    </div>
    {selected && <CheckIcon />}
  </div>
);

<Combobox
  value={value}
  onChange={setValue}
  fetchOptions={fetchUsers}
  renderOption={renderOption}
/>
```

### Custom Error Handling

```tsx
const renderError = (error: Error) => (
  <div className="flex flex-col items-center gap-2 p-4">
    <AlertIcon />
    <span className="text-red-600">{error.message}</span>
    <button onClick={retry} className="text-blue-600">
      Retry
    </button>
  </div>
);

<Combobox
  value={value}
  onChange={setValue}
  fetchOptions={fetchUsers}
  renderError={renderError}
/>
```

### Custom Display Value

```tsx
// Show "Name (email)" in the input when selected
const displayValue = (userId: number | null) => {
  if (!userId) return '';
  const user = users.find(u => u.id === userId);
  return user ? `${user.name} (${user.email})` : '';
};

<Combobox
  value={userId}
  onChange={setUserId}
  fetchOptions={fetchUsers}
  displayValue={displayValue}
/>
```

### Multi-Select Pattern

```tsx
function MultiSelect() {
  const [selected, setSelected] = React.useState<string[]>([]);
  const [current, setCurrent] = React.useState<string | null>(null);

  const handleChange = (value: string | null) => {
    if (value && !selected.includes(value)) {
      setSelected([...selected, value]);
      setCurrent(null);
    }
  };

  // Filter out already selected items
  const availableOptions = options.filter(
    opt => !selected.includes(opt.value)
  );

  return (
    <>
      <SimpleCombobox
        value={current}
        onChange={handleChange}
        options={availableOptions}
      />
      <SelectedTags tags={selected} onRemove={removeTag} />
    </>
  );
}
```

### With TRPC

```tsx
import { trpc } from '~/src/trpc-client';

function TRPCCombobox() {
  const [userId, setUserId] = React.useState<number | null>(null);

  const fetchUsers = async ({ query, page, pageSize }: ComboboxFetchOptions) => {
    const data = await trpc.users.search.query({
      query,
      page,
      limit: pageSize,
    });

    return {
      items: data.users.map(user => ({
        value: user.id,
        label: user.name,
      })),
      hasMore: data.hasMore,
      total: data.total,
    };
  };

  return (
    <Combobox
      value={userId}
      onChange={setUserId}
      fetchOptions={fetchUsers}
    />
  );
}
```

## How It Works

### State Management

The component manages several internal states:
- `query` - Current search query (user input)
- `options` - Loaded options array
- `isLoading` - Initial loading state
- `isLoadingMore` - Pagination loading state
- `fetchError` - Error state
- `page` - Current page number
- `hasMore` - Whether more pages exist

### Debouncing

User input is debounced using a custom `useDebounce` hook to prevent excessive API calls. The debounce delay is configurable via `debounceMs` prop.

### Request Cancellation

Each fetch request creates an `AbortController`. When a new request starts, the previous request is cancelled automatically. This prevents race conditions and wasted network requests.

### Infinite Scroll

An `IntersectionObserver` watches a sentinel element at the bottom of the options list. When it becomes visible:
1. The next page is calculated
2. The fetch function is called with the new page number
3. New options are appended to the existing list

### Error Recovery

When a fetch fails:
- The error is stored in state
- Options are cleared
- A custom error UI is shown
- The error UI can include retry logic

## Performance Tips

1. **Memoize fetch functions** - Use `React.useCallback` to prevent unnecessary re-fetches
2. **Adjust debounce** - Increase `debounceMs` for expensive API calls
3. **Optimize page size** - Balance UX (smaller pages = faster initial load) vs efficiency (larger pages = fewer requests)
4. **Use min query length** - Set `minQueryLength` to prevent fetching on empty queries
5. **Server-side filtering** - Don't return all data and filter client-side; filter on the server

## Styling

The component uses Tailwind CSS classes. You can:

1. **Override via props:**
```tsx
<Combobox
  className="max-w-md"
  inputClassName="border-red-500"
  optionsClassName="shadow-xl"
/>
```

2. **Customize colors in Tailwind config:**
```js
// tailwind.config.js
theme: {
  extend: {
    colors: {
      blue: { /* your blue shades */ },
    }
  }
}
```

## Accessibility

Built on Headless UI, the component includes:
- ARIA labels and roles
- Keyboard navigation (Arrow keys, Enter, Escape)
- Focus management
- Screen reader announcements

Additional accessibility can be added via:
```tsx
<Combobox
  label="Required field"
  error={errors.field}
  aria-required="true"
/>
```

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Requires `IntersectionObserver` support (available in all modern browsers)

## Examples

See `src/ui/combobox-examples.tsx` for complete working examples including:
- Simple static data
- Async API fetching
- Custom rendering
- Error handling
- Large datasets
- Multi-select pattern
- Custom display values

## TypeScript

The component is fully typed with TypeScript generics:

```typescript
// String values
Combobox<string>

// Number values  
Combobox<number>

// Custom branded types
type UserId = string & { __brand: 'UserId' };
Combobox<UserId>
```

## License

Part of the normalizer.app project.

















