import { useI18n } from '~/src/i18n/use-i18n';
import { Button } from '~/src/ui/button';
import { IconX } from '~/src/ui/icons';
import { Spinner } from '~/src/ui/spinner';
import { Typography } from '~/src/ui/typography';
import type { NormalizationSessionProjectionEntry } from '../../normalization-session-projection/normalization-session-projection-entry';
import type { NormalizationSessionId } from '../../normalization-session-id';
import { useCancelNormalization } from '../use-cancel-normalization';
import { EntryArtifactsSection } from './entry-artifacts-section';
import { EntryContainer } from './entry-container';
import { EntryDate } from './entry-date';

export const InProgressEntry = (props: {
  entry: NormalizationSessionProjectionEntry;
  normalizationSessionId: NormalizationSessionId;
}) => {
  const { t } = useI18n();
  const cancelNormalization = useCancelNormalization(props.normalizationSessionId);

  if (props.entry.type !== 'normalization') {
    throw new Error('InProgressEntry can only render normalization entries');
  }

  return (
    <EntryContainer variant="default">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Spinner size="sm" />
          <Typography
            variant="sm"
            color="primary"
            weight="medium"
            as="p"
            text={t('normalizationSession.inProgress')}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          startIcon={<IconX className="size-4" />}
          text={t('common.cancel')}
          onClick={() =>
            cancelNormalization.mutate({ normalizationRunId: props.entry.normalizationRunId })
          }
          loading={cancelNormalization.isPending}
          disabled={cancelNormalization.isPending}
        />
      </div>
      <EntryArtifactsSection
        artifactIds={props.entry.inputArtifactIds}
        labelKey="normalizationSession.inputArtifactsLabel"
      />
      <EntryDate date={props.entry.createdAt} />
    </EntryContainer>
  );
};
