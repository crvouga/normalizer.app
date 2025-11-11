import { IconSpinner } from './icons';

type AllowedSizes = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface SpinnerProps {
  size?: AllowedSizes;
  className?: string;
}

/**
 * Spinner using tailwind width/height classes mapped from size tokens.
 * All sizes increased from baseline.
 */
const sizeMap: Record<AllowedSizes, string> = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
};

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <IconSpinner
      className={`${sizeMap[size]} animate-spin text-purple-600 dark:text-purple-400${className ? ` ${className}` : ''}`}
    />
  );
}
