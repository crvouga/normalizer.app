import { cn } from '~/src/lib/cn';
import { IconSparkles } from './icons';

type LogoSize = 'sm' | 'md' | 'lg' | 'xl';

interface AnimatedLogoProps {
  size?: LogoSize;
  className?: string;
}

const sizeConfig = {
  sm: 'size-12',
  md: 'size-16',
  lg: 'size-24',
  xl: 'size-32',
} as const;

// A much simpler, glowing and pulsing animated logo
export function AnimatedLogo({ size = 'lg', className }: AnimatedLogoProps) {
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="purple-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="50%" stopColor="#9333ea" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
        </defs>
      </svg>
      <span className={cn('relative inline-flex items-center justify-center', className)}>
        <span
          className={cn(
            // bg-purple-400/15 is a more faint version than /30
            'animate-logo-glow-pulse pointer-events-none absolute inset-0 rounded-full bg-purple-400/15 blur',
            sizeConfig[size],
          )}
          aria-hidden="true"
        />
        <IconSparkles
          className={cn(sizeConfig[size], 'relative drop-shadow-[0_0_8px_rgba(139,92,246,0.3)]')}
          style={{ fill: 'url(#purple-gradient)' }}
        />
      </span>
      <style>
        {`
          @keyframes logo-glow-pulse {
            0%, 100% {
              opacity: 0.4;
              filter: blur(8px);
              transform: scale(1);
            }
            50% {
              opacity: 0.65;
              filter: blur(4px);
              transform: scale(1.07);
            }
          }
          .animate-logo-glow-pulse {
            animation: logo-glow-pulse 1.6s ease-in-out infinite;
          }
        `}
      </style>
    </>
  );
}
