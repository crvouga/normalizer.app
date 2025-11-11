import { cn } from '../lib/cn';
import { IconSpinner } from './icons';

type AllowedSizes = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type AllowedColors = 'purple' | 'white';

interface SpinnerProps {
  size?: AllowedSizes;
  className?: string;
  color?: AllowedColors;
}

const sizeMap: Record<AllowedSizes, string> = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
};

const colorMap: Record<AllowedColors, string> = {
  purple: 'text-purple-600 dark:text-purple-400',
  white: 'text-white dark:text-slate-50',
};

export function Spinner({ size = 'md', className, color = 'purple' }: SpinnerProps) {
  return <IconSpinner className={cn(sizeMap[size], colorMap[color], 'animate-spin', className)} />;
}
