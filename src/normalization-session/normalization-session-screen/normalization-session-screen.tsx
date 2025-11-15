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
          className="flex w-full flex-1 flex-col overflow-y-scroll px-4 py-8 md:px-8"
        >
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
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
          <div className="mx-auto flex w-full max-w-4xl flex-col px-4 py-4 md:px-8">
            <NormalizationSessionScreenInputForm
              normalizationSessionId={props.normalizationSessionId}
              normalizationSessionProjection={normalizationSessionProjection}
            />
          </div>
        </div>
      </div>
    </PolicyCheckGuard>
  );
};
