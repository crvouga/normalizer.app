import { cn } from '~/src/lib/cn';

type DividerProps = {
  className?: string;
};

export function Divider({ className }: DividerProps) {
  return <div className={cn('border-t border-gray-200 dark:border-gray-700', className)} />;
}
