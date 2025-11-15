import { useEffect, useRef } from 'react';
import { PolicyCheckGuard } from '~/src/permissions/policy-check-guard';
import { useEntityStoreSelector } from '~/src/store/entity-store';
import { SpinnerBlock } from '~/src/ui/spinner-block';
import { useCurrentScreen } from '../../screen/use-current-screen';
import type { NormalizationSessionId } from '../normalization-session-id';
import {
  canViewNormalizationSession,
  viewNormalizationSessionPolicy,
} from '../normalization-session-permissions';
import { NormalizationSessionEntry } from './normalization-session-entry';
import { NormalizationSessionHeader } from './normalization-session-screen-header';
import { NormalizationSessionScreenInputForm } from './normalization-session-screen-input-form';
import { useNormalizationSessionLoader } from './use-normalization-session-events-loader';

export const NormalizationSessionScreen = (props: {
  normalizationSessionId: NormalizationSessionId;
}) => {
  const { setCurrentScreen } = useCurrentScreen();
  useNormalizationSessionLoader(props.normalizationSessionId);

  const normalizationSessionProjection = useEntityStoreSelector(
    (s) => s.entities.normalizationSessionProjections.byId[props.normalizationSessionId],
  );

  const scrollableContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when entries change
  useEffect(() => {
    const container = scrollableContainerRef.current;
    if (container && normalizationSessionProjection) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }
  }, [normalizationSessionProjection?.entries.length, normalizationSessionProjection]);

  if (!normalizationSessionProjection) return <SpinnerBlock />;

  return (
    <PolicyCheckGuard
      permission={canViewNormalizationSession(props.normalizationSessionId)}
      policy={viewNormalizationSessionPolicy}
      onRedirect={() => setCurrentScreen({ type: 'start-normalization-session' })}
    >
      <div className="flex h-full w-full flex-col">
        <NormalizationSessionHeader
          targetArtifactIds={normalizationSessionProjection.targetArtifactIds}
        />

        <div
          ref={scrollableContainerRef}
          className="flex w-full flex-1 flex-col items-center overflow-y-scroll px-8 py-8"
        >
          <div className="flex w-full max-w-2xl flex-col gap-4">
            {normalizationSessionProjection.entries.map((entry) => (
              <NormalizationSessionEntry
                key={entry.id}
                entry={entry}
                normalizationSessionId={props.normalizationSessionId}
              />
            ))}
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <div className="flex w-full flex-col items-center px-8 py-4">
            <div className="w-full max-w-2xl">
              <NormalizationSessionScreenInputForm
                normalizationSessionId={props.normalizationSessionId}
                normalizationSessionProjection={normalizationSessionProjection}
              />
            </div>
          </div>
        </div>
      </div>
    </PolicyCheckGuard>
  );
};
