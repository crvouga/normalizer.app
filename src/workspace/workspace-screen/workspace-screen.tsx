import { useScrollbarWidth } from '~/src/lib/use-scrollbar-width';
import { PolicyCheckGuard } from '~/src/permissions/policy-check-guard';
import { useEntityStoreSelector } from '~/src/store/entity-store';
import { ChatScrollBox } from '~/src/ui/chat-scrollbox';
import { SpinnerBlock } from '~/src/ui/spinner-block';
import { useCurrentScreen } from '../../screen/use-current-screen';
import type { WorkspaceId } from '../workspace-id';
import { canViewWorkspace, viewWorkspacePolicy } from '../workspace-permissions';
import { useWorkspaceSubscription } from '../workspace-projection/use-workspace-subscription';
import { WorkspaceEntry } from './workspace-entry';
import { WorkspaceScreenHeader } from './workspace-screen-header';
import { WorkspaceScreenInputForm } from './workspace-screen-input-form';

export const WorkspaceScreen = (props: { workspaceId: WorkspaceId }) => {
  const { setCurrentScreen } = useCurrentScreen();
  useWorkspaceSubscription(props.workspaceId);

  const workspaceProjection = useEntityStoreSelector(
    (s) => s.entities.workspaceProjections.byId[props.workspaceId],
  );
  const scrollbarWidth = useScrollbarWidth();

  if (!workspaceProjection) return <SpinnerBlock />;

  return (
    <PolicyCheckGuard
      permission={canViewWorkspace(props.workspaceId)}
      policy={viewWorkspacePolicy}
      onRedirect={() => setCurrentScreen({ type: 'start-workspace' })}
    >
      <div className="relative flex h-full w-full flex-col">
        <WorkspaceScreenHeader targetArtifactIds={workspaceProjection.targetArtifactIds} />

        <ChatScrollBox
          className="px-4 py-8 md:px-6"
          contentClassName="gap-6 max-w-4xl"
          bottomPadding="pb-56 md:pb-64"
          scrollKey={workspaceProjection?.entries.map((entry) => entry.id).join(',')}
          autoScroll
        >
          {workspaceProjection.entries.map((entry) => (
            <WorkspaceEntry key={entry.id} entry={entry} workspaceId={props.workspaceId} />
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
              <WorkspaceScreenInputForm
                workspaceId={props.workspaceId}
                workspaceProjection={workspaceProjection}
              />
            </div>
          </div>
        </div>
      </div>
    </PolicyCheckGuard>
  );
};
