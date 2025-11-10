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

// Glowing and pulsing animated logo with a more subtle faint radial gradient
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
            // bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] bg-purple-400/10 may be used for a very faint radial ambient glow:
            'animate-logo-glow-pulse pointer-events-none absolute inset-0 rounded-full blur',
            sizeConfig[size],
          )}
          style={{
            background: 'radial-gradient(ellipse at center, #a855f7 0%, #9333ea 60%, #7c3aed 100%)',
            opacity: 0.08, // Reduced from 0.18 to 0.08 for a less pronounced glow
          }}
          aria-hidden="true"
        />
        <IconSparkles
          className={cn(sizeConfig[size], 'relative drop-shadow-[0_0_4px_rgba(139,92,246,0.15)]')}
          // reduced the drop-shadow as well (was 8px, now 4px, and lower opacity)
          style={{ fill: 'url(#purple-radial-gradient)' }}
        />
      </span>
      <style>
        {`
          @keyframes logo-glow-pulse {
            0%, 100% {
              opacity: 0.22; /* was 0.4 */
              filter: blur(7px); /* was 8px */
              transform: scale(1);
            }
            50% {
              opacity: 0.38; /* was 0.65 */
              filter: blur(3px); /* was 4px */
              transform: scale(1.05); /* was 1.07 */
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
