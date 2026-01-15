import { Spinner } from '~/src/ui/spinner';
import { Typography } from '~/src/ui/typography';
import { toI18nText } from '~/src/i18n/types';

/**
 * Initial loading state for the normalization session list.
 */
export function WorkspaceListLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center p-8">
      <div className="flex w-full flex-col items-center justify-center">
        <Spinner size="lg" />
        <Typography
          variant="sm"
          color="muted"
          className="mt-4 text-center"
          text={toI18nText('Loading sessions...')}
        />
      </div>
    </div>
  );
}
