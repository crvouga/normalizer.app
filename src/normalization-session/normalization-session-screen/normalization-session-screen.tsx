import { PolicyCheckGuard } from '~/src/permissions/policy-check-guard';
import { useEntityStoreSelector } from '~/src/store/entity-store';
import { SpinnerBlock } from '~/src/ui/spinner-block';
import { ChatScrollBox } from '~/src/ui/chat-scrollbox';
import { useScrollbarWidth } from '~/src/lib/use-scrollbar-width';
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
  const scrollbarWidth = useScrollbarWidth();

  if (!normalizationSessionProjection) return <SpinnerBlock />;

  return (
    <PolicyCheckGuard
      permission={canViewNormalizationSession(props.normalizationSessionId)}
      policy={viewNormalizationSessionPolicy}
      onRedirect={() => setCurrentScreen({ type: 'start-normalization-session' })}
    >
      <div className="relative flex h-full w-full flex-col">
        <NormalizationSessionHeader
          targetArtifactIds={normalizationSessionProjection.targetArtifactIds}
        />

        <ChatScrollBox
          className="px-4 py-8 md:px-8"
          contentClassName="gap-6 max-w-4xl"
          bottomPadding="pb-56 md:pb-64"
          scrollKey={normalizationSessionProjection?.entries.map((entry) => entry.id).join(',')}
          autoScroll
        >
          {normalizationSessionProjection.entries.map((entry) => (
            <NormalizationSessionEntry
              key={entry.id}
              entry={entry}
              normalizationSessionId={props.normalizationSessionId}
            />
          ))}
          {/* Spacer to ensure last entry isn't cut off by floating input */}
          <div className="h-8 md:h-12" />
        </ChatScrollBox>

        {/* Floating input section */}
        <div
          className="absolute right-0 bottom-0 left-0 z-10 shrink-0 bg-transparent"
          style={{ paddingRight: scrollbarWidth }}
        >
          <div className="mx-auto flex w-full max-w-4xl flex-col">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-lg md:px-6 md:py-5 dark:border-slate-700 dark:bg-slate-800">
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
