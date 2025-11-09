import { Button } from '~/src/ui/button';

import { useState } from 'react';
import type { ArtifactId } from '../artifacts/artifact-id';
import { ArtifactsInput } from '../artifacts/artifacts-input/artifacts-input';
import { useI18n } from '../i18n/use-i18n';

export const NormalizationSessionScreen = (props: { normalizationSessionId: string | null }) => {
  const { t } = useI18n();
  const [targetArtifactIds, setTargetArtifactIds] = useState<ArtifactId[]>([]);

  return (
    <div className="flex h-full w-full items-start justify-center bg-white p-8 dark:bg-gray-900">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <ArtifactsInput value={targetArtifactIds} onChange={setTargetArtifactIds} />

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
