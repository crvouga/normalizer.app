import type { ArtifactId } from '~/src/artifacts/artifact-id';
import { useI18n } from '~/src/i18n/use-i18n';
import { Sparkles } from '~/src/ui/sparkles';
import { Typography } from '~/src/ui/typography';
import { EntryContainer } from './entry-container';

export const PendingEntry = (props: { inputArtifactIds: ArtifactId[] }) => {
  const { t } = useI18n();

  return (
    <EntryContainer variant="default">
      <div className="flex flex-col items-center justify-center gap-3">
        <Sparkles size="sm" />
        <Typography
          variant="xs"
          color="muted"
          as="p"
          className="text-center"
          text={t('normalizationSession.normalizing')}
        />
      </div>
    </EntryContainer>
  );
};
