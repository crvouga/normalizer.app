import { useContext } from 'react';
import { ThemeContext, type Theme, type EffectiveTheme } from './theme-context';

export type { Theme, EffectiveTheme };

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
