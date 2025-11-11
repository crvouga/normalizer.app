import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import { I18nProvider } from './i18n/i18n-context';
import { ThemeProvider } from './ui/theme/theme-context';
import { ToastProvider } from './ui/toast';
import { UserProvider } from './users/user-context';

const elem = document.getElementById('root');

if (!elem) throw new Error('Root element not found');

const app = (
  <StrictMode>
    <I18nProvider>
      <UserProvider>
        <ThemeProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </ThemeProvider>
      </UserProvider>
    </I18nProvider>
  </StrictMode>
);

if (import.meta.hot) {
  const root = (import.meta.hot.data.root ??= createRoot(elem));
  root.render(app);
} else {
  createRoot(elem).render(app);
}
