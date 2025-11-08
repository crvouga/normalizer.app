# Internationalization (i18n)

This directory contains the minimalistic i18n system for the application.

## Structure

- `locales/` - Translation files for each language
  - `en.json` - English translations (default)
- `i18n-context.tsx` - React Context provider for i18n
- `use-i18n.ts` - React hook to access translations
- `types.ts` - TypeScript types for type-safe translations

## Usage

### Using translations in components

```tsx
import { useI18n } from '~/src/i18n/use-i18n';

function MyComponent() {
  const { t } = useI18n();

  return (
    <div>
      <h1>{t('app.title')}</h1>
      <p>{t('settings.title')}</p>
    </div>
  );
}
```

### With interpolation (future)

The system supports interpolation for dynamic values:

```tsx
// In en.json: "greeting": "Hello, {{name}}!"
t('greeting', { name: 'John' }); // Returns: "Hello, John!"
```

## Adding a new language

1. Create a new locale file (e.g., `locales/es.json`) with the same structure as `en.json`
2. Update `types.ts` to include the new locale in the `Locale` type
3. Import and add the new locale to the `translations` object in `i18n-context.tsx`
4. (Optional) Add a language selector UI component
5. (Optional) Store user preference in localStorage

## Features

- **Type-safe**: Translation keys are type-checked at compile time
- **Zero dependencies**: Uses only React Context API
- **Nested keys**: Supports dot notation (e.g., `theme.light`)
- **Interpolation**: Supports dynamic values with `{{placeholder}}` syntax
- **Fallback**: Falls back to key if translation is missing (dev-friendly)
- **Minimal**: Small bundle size with no external i18n libraries

## Translation Keys Convention

- Use dot notation for nested namespaces
- Keep keys descriptive and organized by feature/domain
- Group related translations under common prefixes (e.g., `theme.*`, `app.*`)
