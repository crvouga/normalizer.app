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

// Glowing and pulsing animated logo with a less prominent, faint radial gradient
export function AnimatedLogo({ size = 'lg', className }: AnimatedLogoProps) {
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <radialGradient id="purple-radial-gradient" cx="50%" cy="50%" r="80%">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="60%" stopColor="#9333ea" />
            <stop offset="100%" stopColor="#7c3aed" />
          </radialGradient>
        </defs>
      </svg>
      <span className={cn('relative inline-flex items-center justify-center', className)}>
        <span
          className={cn(
            'animate-logo-glow-pulse pointer-events-none absolute inset-0 rounded-full blur',
            sizeConfig[size],
          )}
          style={{
            background: 'radial-gradient(ellipse at center, #a855f7 0%, #9333ea 60%, #7c3aed 100%)',
            opacity: 0.04, // Lowered from 0.08 to 0.04 for a much more subtle glow
          }}
          aria-hidden="true"
        />
        <IconSparkles
          className={cn(sizeConfig[size], 'relative drop-shadow-[0_0_2px_rgba(139,92,246,0.10)]')} // drop-shadow lessened: only 2px and 0.10 opacity
          style={{ fill: 'url(#purple-radial-gradient)' }}
        />
      </span>
      <style>
        {`
          @keyframes logo-glow-pulse {
            0%, 100% {
              opacity: 0.12; /* Lowered from 0.22 */
              filter: blur(5px); /* Lowered from 7px */
              transform: scale(1);
            }
            50% {
              opacity: 0.18; /* Lowered from 0.38 */
              filter: blur(2px); /* Lowered from 3px */
              transform: scale(1.03); /* Slightly less scaling */
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
