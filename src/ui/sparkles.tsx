import colors from 'tailwindcss/colors';
import { cn } from '~/src/lib/cn';
import { hexToRgb } from '../lib/color/hex-to-rgb';
import { IconSparkles } from './icons';

type LogoSize = 'sm' | 'md' | 'lg' | 'xl';

interface SparklesProps {
  size?: LogoSize;
  className?: string;
  glow?: boolean; // Optional glowing background prop
}

const sizeConfig = {
  sm: 'size-12',
  md: 'size-16',
  lg: 'size-24',
  xl: 'size-32',
} as const;

export function Sparkles({ size = 'lg', className, glow = true }: SparklesProps) {
  const fuchsia500 = colors.fuchsia[500];
  const fuchsia500rgb = hexToRgb(fuchsia500);
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <radialGradient id="fuchsia-radial-gradient" cx="50%" cy="50%" r="80%">
            <stop offset="0%" stopColor={colors.fuchsia[400]} />
            <stop offset="60%" stopColor={colors.fuchsia[500]} />
            <stop offset="100%" stopColor={colors.fuchsia[600]} />
          </radialGradient>
        </defs>
      </svg>
      <span className={cn('relative inline-flex items-center justify-center', className)}>
        {glow && (
          <span
            className={cn(
              'animate-logo-glow-pulse pointer-events-none absolute inset-0 rounded-full blur',
              sizeConfig[size],
            )}
            style={{
              background: `radial-gradient(ellipse at center, ${colors.fuchsia[400]} 0%, ${colors.fuchsia[500]} 60%, ${colors.fuchsia[600]} 100%)`,
              opacity: 0.04,
            }}
            aria-hidden="true"
          />
        )}
        <IconSparkles
          className={cn(
            sizeConfig[size],
            `relative drop-shadow-[0_0_2px_rgba(${fuchsia500rgb[0]},${fuchsia500rgb[1]},${fuchsia500rgb[2]},0.10)]`,
          )}
          style={{ fill: 'url(#fuchsia-radial-gradient)' }}
        />
      </span>
      {glow && (
        <style>
          {`
            @keyframes logo-glow-pulse {
              0%, 100% {
                opacity: 0.12;
                filter: blur(5px);
                transform: scale(1);
              }
              50% {
                opacity: 0.18;
                filter: blur(2px);
                transform: scale(1.03);
              }
            }
            .animate-logo-glow-pulse {
              animation: logo-glow-pulse 1.6s ease-in-out infinite;
            }
          `}
        </style>
      )}
    </>
  );
}
