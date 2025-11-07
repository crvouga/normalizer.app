import { useContext } from 'react';
import { ThemeContext, type EffectiveTheme, type Theme } from './theme-context';

export type { EffectiveTheme, Theme };

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
