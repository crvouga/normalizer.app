import { RadioGroup, type RadioOption } from '~/src/ui/radio-group';
import { useTheme, type Theme } from '~/src/ui/theme/use-theme';

interface ThemeRadioGroupProps {}

const THEME_RADIO_OPTIONS: RadioOption<Theme>[] = [
  {
    value: 'system',
    label: 'System',
    description: 'Matches your system preference',
  },
  {
    value: 'light',
    label: 'Light',
    description: 'Light mode',
  },
  {
    value: 'dark',
    label: 'Dark',
    description: 'Dark mode',
  },
];

export function ThemeRadioGroup({}: ThemeRadioGroupProps) {
  const { theme, setTheme } = useTheme();

  return (
    <RadioGroup
      value={theme}
      onChange={setTheme}
      options={THEME_RADIO_OPTIONS}
      label="Appearance"
    />
  );
}
