import { Button } from '~/src/ui/button';

import { useState } from 'react';
import type { ArtifactId } from '../artifacts/artifact-id';
import { ArtifactsField } from '../artifacts/artifacts-input/artifacts-field';
import { useI18n } from '../i18n/use-i18n';

export const NormalizationSessionScreen = (props: { normalizationSessionId: string | null }) => {
  const { t } = useI18n();
  const [targetArtifactIds, setTargetArtifactIds] = useState<ArtifactId[]>([]);

  return (
    <div className="flex h-full w-full items-start justify-center p-8">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <ArtifactsField
          label={t('session.targetArtifact')}
          value={targetArtifactIds}
          onChange={setTargetArtifactIds}
        />

        <div className="flex justify-end">
          <Button
            size="lg"
            type="submit"
            disabled={targetArtifactIds.length === 0}
            text={t('session.startButton')}
          />
        </div>
      </div>
    </div>
  );
};
