import { useState } from 'react';
import type { ArtifactId } from '~/src/artifacts/artifact-id';
import { ArtifactsField } from '~/src/artifacts/artifacts-input/artifacts-field';
import { useI18n } from '~/src/i18n/use-i18n';
import { Button } from '~/src/ui/button';
import { IconSparkles } from '~/src/ui/icons';
import type { NormalizationSessionId } from '../normalization-session-id';
import { useRequestNormalization } from './use-request-normalization';

export const NormalizationSessionInputForm = (props: {
  normalizationSessionId: NormalizationSessionId;
}) => {
  const { t } = useI18n();
  const [inputArtifactIds, setInputArtifactIds] = useState<ArtifactId[]>([]);
  const requestNormalization = useRequestNormalization(props.normalizationSessionId);

  return (
    <div className="space-y-4">
      <ArtifactsField
        label={t('normalizationSession.inputArtifactsLabel')}
        value={inputArtifactIds}
        onChange={setInputArtifactIds}
      />
      <div className="flex justify-end">
        <Button
          size="lg"
          startIcon={<IconSparkles className="size-6" />}
          text={t('normalizationSession.normalize')}
          onClick={() => requestNormalization.mutate({ inputArtifactIds })}
          loading={requestNormalization.isPending}
          disabled={inputArtifactIds.length === 0}
        />
      </div>
    </div>
  );
};
