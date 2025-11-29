/**
 * Combobox Component Usage Examples
 * 
 * This file demonstrates various ways to use the Combobox component
 */

import * as React from 'react';
import {
  Combobox,
  SimpleCombobox,
  type ComboboxFetchOptions,
  type ComboboxFetchResult,
  type ComboboxOption,
} from './combobox';

// ============================================================================
// Example 1: Simple Static Data Combobox
// ============================================================================
export function SimpleStaticCombobox() {
  const [selectedFruit, setSelectedFruit] = React.useState<string | null>(null);

  const fruits: ComboboxOption<string>[] = [
    { value: 'apple', label: 'Apple' },
    { value: 'banana', label: 'Banana' },
    { value: 'cherry', label: 'Cherry' },
    { value: 'date', label: 'Date' },
    { value: 'elderberry', label: 'Elderberry' },
  ];

  return (
    <SimpleCombobox
      value={selectedFruit}
      onChange={setSelectedFruit}
      options={fruits}
      placeholder="Select a fruit..."
      label="Favorite Fruit"
    />
  );
}

// ============================================================================
// Example 2: Async Data Fetching with API
// ============================================================================
interface User {
  id: number;
  name: string;
  email: string;
}

export function AsyncUserCombobox() {
  const [selectedUserId, setSelectedUserId] = React.useState<number | null>(null);

  const fetchUsers = React.useCallback(
    async ({ query, page, pageSize, signal }: ComboboxFetchOptions): Promise<ComboboxFetchResult<number>> => {
      const response = await fetch(
        `https://api.example.com/users?q=${encodeURIComponent(query)}&page=${page}&limit=${pageSize}`,
        { signal }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();

      return {
        items: data.users.map((user: User) => ({
          value: user.id,
          label: user.name,
          metadata: { email: user.email },
        })),
        hasMore: data.hasMore,
        total: data.total,
      };
    },
    []
  );

  return (
    <Combobox
      value={selectedUserId}
      onChange={setSelectedUserId}
      fetchOptions={fetchUsers}
      placeholder="Search users..."
      label="Select User"
      debounceMs={500}
      minQueryLength={2}
    />
  );
}

// ============================================================================
// Example 3: Custom Rendering with Rich Options
// ============================================================================
interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  inStock: boolean;
}

export function ProductCombobox() {
  const [selectedProduct, setSelectedProduct] = React.useState<string | null>(null);

  const fetchProducts = React.useCallback(
    async ({ query, page, pageSize }: ComboboxFetchOptions): Promise<ComboboxFetchResult<string>> => {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 300));

      const mockProducts: Product[] = [
        { id: '1', name: 'Laptop', price: 999, category: 'Electronics', inStock: true },
        { id: '2', name: 'Mouse', price: 29, category: 'Electronics', inStock: true },
        { id: '3', name: 'Keyboard', price: 79, category: 'Electronics', inStock: false },
        { id: '4', name: 'Monitor', price: 299, category: 'Electronics', inStock: true },
      ].filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));

      const start = page * pageSize;
      const end = start + pageSize;

      return {
        items: mockProducts.slice(start, end).map((product) => ({
          value: product.id,
          label: product.name,
          disabled: !product.inStock,
          metadata: { price: product.price, category: product.category, inStock: product.inStock },
        })),
        hasMore: end < mockProducts.length,
        total: mockProducts.length,
      };
    },
    []
  );

  const renderOption = (option: ComboboxOption<string>, selected: boolean) => (
    <div className="flex items-center justify-between">
      <div className="flex flex-col">
        <span className={selected ? 'font-semibold' : ''}>{option.label}</span>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>${option.metadata?.price}</span>
          <span>•</span>
          <span>{option.metadata?.category as string}</span>
          {!option.metadata?.inStock && (
            <>
              <span>•</span>
              <span className="text-red-600">Out of Stock</span>
            </>
          )}
        </div>
      </div>
      {selected && (
        <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      )}
    </div>
  );

  return (
    <Combobox
      value={selectedProduct}
      onChange={setSelectedProduct}
      fetchOptions={fetchProducts}
      placeholder="Search products..."
      label="Select Product"
      renderOption={renderOption}
      helperText="Out of stock items are disabled"
    />
  );
}

// ============================================================================
// Example 4: With Error Handling
// ============================================================================
export function ComboboxWithErrorHandling() {
  const [selectedItem, setSelectedItem] = React.useState<string | null>(null);
  const [shouldFail, setShouldFail] = React.useState(false);

  const fetchData = React.useCallback(
    async ({ query }: ComboboxFetchOptions): Promise<ComboboxFetchResult<string>> => {
      await new Promise((resolve) => setTimeout(resolve, 500));

      if (shouldFail) {
        throw new Error('Failed to fetch data. Please try again.');
      }

      const items = ['Option 1', 'Option 2', 'Option 3']
        .filter((item) => item.toLowerCase().includes(query.toLowerCase()))
        .map((item) => ({ value: item, label: item }));

      return {
        items,
        hasMore: false,
        total: items.length,
      };
    },
    [shouldFail]
  );

  const renderError = (error: Error) => (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-sm">
      <svg className="h-8 w-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span className="font-medium text-red-600">{error.message}</span>
      <button
        onClick={() => setShouldFail(false)}
        className="mt-2 rounded bg-red-100 px-3 py-1 text-xs text-red-700 hover:bg-red-200"
      >
        Retry
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={shouldFail}
          onChange={(e) => setShouldFail(e.target.checked)}
        />
        <span className="text-sm">Simulate Error</span>
      </label>

      <Combobox
        value={selectedItem}
        onChange={setSelectedItem}
        fetchOptions={fetchData}
        placeholder="Search..."
        label="Select Item"
        renderError={renderError}
      />
    </div>
  );
}

// ============================================================================
// Example 5: Large Dataset with Infinite Scroll
// ============================================================================
export function LargeDatasetCombobox() {
  const [selectedId, setSelectedId] = React.useState<number | null>(null);

  const fetchLargeDataset = React.useCallback(
    async ({ query, page, pageSize }: ComboboxFetchOptions): Promise<ComboboxFetchResult<number>> => {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 400));

      // Generate large dataset (1000 items)
      const allItems = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        name: `Item ${i + 1}`,
        description: `Description for item ${i + 1}`,
      }));

      // Filter based on query
      const filtered = query
        ? allItems.filter((item) => item.name.toLowerCase().includes(query.toLowerCase()))
        : allItems;

      // Paginate
      const start = page * pageSize;
      const end = start + pageSize;
      const items = filtered.slice(start, end);

      return {
        items: items.map((item) => ({
          value: item.id,
          label: item.name,
          metadata: { description: item.description },
        })),
        hasMore: end < filtered.length,
        total: filtered.length,
      };
    },
    []
  );

  return (
    <Combobox
      value={selectedId}
      onChange={setSelectedId}
      fetchOptions={fetchLargeDataset}
      placeholder="Search from 1000 items..."
      label="Large Dataset"
      pageSize={20}
      helperText="Scroll down in the dropdown to load more items"
    />
  );
}

// ============================================================================
// Example 6: Multi-select Pattern (using multiple combobox instances)
// ============================================================================
export function MultiSelectExample() {
  const [selectedTags, setSelectedTags] = React.useState<string[]>([]);
  const [currentSelection, setCurrentSelection] = React.useState<string | null>(null);

  const tags: ComboboxOption<string>[] = [
    { value: 'react', label: 'React' },
    { value: 'typescript', label: 'TypeScript' },
    { value: 'javascript', label: 'JavaScript' },
    { value: 'nodejs', label: 'Node.js' },
    { value: 'python', label: 'Python' },
    { value: 'rust', label: 'Rust' },
  ].filter((tag) => !selectedTags.includes(tag.value));

  const handleChange = (value: string | null) => {
    if (value && !selectedTags.includes(value)) {
      setSelectedTags([...selectedTags, value]);
      setCurrentSelection(null);
    }
  };

  const removeTag = (tag: string) => {
    setSelectedTags(selectedTags.filter((t) => t !== tag));
  };

  return (
    <div className="space-y-4">
      <SimpleCombobox
        value={currentSelection}
        onChange={handleChange}
        options={tags}
        placeholder="Add tags..."
        label="Select Tags"
      />

      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800"
            >
              {tag}
              <button
                onClick={() => removeTag(tag)}
                className="hover:text-blue-900"
                aria-label={`Remove ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Example 7: Custom Display Value
// ============================================================================
export function CustomDisplayValueCombobox() {
  const [selectedUserId, setSelectedUserId] = React.useState<number | null>(null);
  const [users, setUsers] = React.useState<Array<{ id: number; name: string; email: string }>>([]);

  const fetchUsers = React.useCallback(
    async ({ query, page, pageSize }: ComboboxFetchOptions): Promise<ComboboxFetchResult<number>> => {
      await new Promise((resolve) => setTimeout(resolve, 300));

      const mockUsers = [
        { id: 1, name: 'John Doe', email: 'john@example.com' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
        { id: 3, name: 'Bob Johnson', email: 'bob@example.com' },
      ].filter(
        (user) =>
          user.name.toLowerCase().includes(query.toLowerCase()) ||
          user.email.toLowerCase().includes(query.toLowerCase())
      );

      setUsers(mockUsers);

      const start = page * pageSize;
      const end = start + pageSize;

      return {
        items: mockUsers.slice(start, end).map((user) => ({
          value: user.id,
          label: user.name,
          metadata: { email: user.email },
        })),
        hasMore: end < mockUsers.length,
        total: mockUsers.length,
      };
    },
    []
  );

  // Custom display value shows "Name (email)"
  const displayValue = (userId: number | null) => {
    if (userId === null) return '';
    const user = users.find((u) => u.id === userId);
    return user ? `${user.name} (${user.email})` : '';
  };

  return (
    <Combobox
      value={selectedUserId}
      onChange={setSelectedUserId}
      fetchOptions={fetchUsers}
      displayValue={displayValue}
      placeholder="Search users..."
      label="Select User"
    />
  );
}

















