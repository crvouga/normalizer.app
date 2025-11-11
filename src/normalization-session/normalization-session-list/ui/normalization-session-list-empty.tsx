import { Typography } from '~/src/ui/typography';

/**
 * Empty state for the normalization session list.
 */
export function NormalizationSessionListEmpty() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center">
        <Typography variant="sm" weight="medium" color="primary" className="">
          No normalization sessions
        </Typography>
        <Typography variant="xs" color="muted" className="mt-1">
          Start a new session to see it here
        </Typography>
      </div>
    </div>
  );
}
