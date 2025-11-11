import { Typography } from '~/src/ui/typography';

interface NormalizationSessionListErrorProps {
  error: Error;
}

/**
 * Error state for the normalization session list.
 */
export function NormalizationSessionListError({ error }: NormalizationSessionListErrorProps) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center">
        <Typography variant="sm" weight="medium" color="error" as="p">
          Failed to load sessions
        </Typography>
        <Typography variant="xs" color="muted" as="p" className="mt-1">
          {error.message}
        </Typography>
      </div>
    </div>
  );
}
