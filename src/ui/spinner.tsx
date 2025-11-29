import { cn } from '../lib/cn';
import { Loader2 } from 'lucide-react';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export type SpinnerColor = 'fuchsia' | 'white';

interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
  color?: SpinnerColor;
}

const sizeMap: Record<SpinnerSize, string> = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
};

const colorMap: Record<SpinnerColor, string> = {
  fuchsia: 'text-fuchsia-600 dark:text-fuchsia-400',
  white: 'text-white dark:text-slate-50',
};

export function Spinner({ size = 'md', className, color = 'fuchsia' }: SpinnerProps) {
  return <Loader2 className={cn(sizeMap[size], colorMap[color], 'animate-spin', className)} />;
}
