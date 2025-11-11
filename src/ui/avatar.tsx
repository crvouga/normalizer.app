import { cn } from '~/src/lib/cn';

type AvatarSize = 'sm' | 'md' | 'lg';

type AvatarProps = {
  src?: string;
  alt?: string;
  initials?: string;
  size?: AvatarSize;
  className?: string;
};

const sizeClasses: Record<AvatarSize, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
};

export function Avatar({ src, alt = 'Avatar', initials, size = 'md', className }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={cn('rounded-full object-cover', sizeClasses[size], className)}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full bg-fuchsia-600 font-medium text-white dark:bg-fuchsia-500',
        sizeClasses[size],
        className,
      )}
    >
      {initials || 'A'}
    </div>
  );
}
