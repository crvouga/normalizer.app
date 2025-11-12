import { cn } from '~/src/lib/cn';

type DividerProps = {
  className?: string;
};

export function Divider({ className }: DividerProps) {
  return (
    <div className={cn('w-full border-t border-slate-200 dark:border-slate-700', className)} />
  );
}
