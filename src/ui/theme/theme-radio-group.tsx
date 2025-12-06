import { RadioGroup, type RadioOption } from '~/src/ui/radio-group';
import { useTheme, type Theme } from '~/src/ui/theme/use-theme';
import { useI18n } from '~/src/i18n/use-i18n';
import { Monitor, Sun, Moon } from 'lucide-react';

interface ThemeRadioGroupProps {}

export function ThemeRadioGroup({}: ThemeRadioGroupProps) {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();

  const THEME_RADIO_OPTIONS: RadioOption<Theme>[] = [
    {
      value: 'system',
      label: t('theme.system'),
      description: t('theme.systemDescription'),
      icon: Monitor,
    },
    {
      value: 'light',
      label: t('theme.light'),
      description: t('theme.lightDescription'),
      icon: Sun,
    },
    {
      value: 'dark',
      label: t('theme.dark'),
      description: t('theme.darkDescription'),
      icon: Moon,
    },
  ];

  return (
    <RadioGroup
      value={theme}
      onChange={setTheme}
      options={THEME_RADIO_OPTIONS}
      label={t('theme.label')}
    />
  );
}
