import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app_';
import { I18nProvider } from './i18n/i18n-context';

const elem = document.getElementById('root');

if (!elem) throw new Error('Root element not found');

const app = (
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>
);

if (import.meta.hot) {
  const root = (import.meta.hot.data.root ??= createRoot(elem));
  root.render(app);
} else {
  createRoot(elem).render(app);
}
