import { useEffect, useMemo, useRef, useState } from 'react';
import type { I18nText } from '~/src/i18n/types';
import { useI18n } from '~/src/i18n/use-i18n';
import { cn } from '~/src/lib/cn';
import { Card, CardContent } from '~/src/ui/card';
import { IconSparkles } from '~/src/ui/icons';
import { Spinner } from '~/src/ui/spinner';
import { Typography } from '~/src/ui/typography';
import type { NormalizationRunId } from '../normalization-run-id';
import type { WorkspaceProjectionEntry } from '../workspace-projection/workspace-projection-entry';
import type { WorkspaceId } from '../workspace-id';
import { buildFeedItems, getPreviewItems, type FeedItem } from './build-feed-items';
import { parseReasoningDisplaySegments } from './parse-reasoning-display-segments';
import { QueryResultBlock } from './query-result-block';
import { SqlCodeBlock } from './sql-code-block';
import { useNormalizationLogs } from './use-normalization-logs';

const PREVIEW_PROGRESS_COUNT = 2;

function ProgressLine(props: { message: string; isError?: boolean; compact?: boolean }) {
  return (
    <div className={cn('flex items-start gap-2 text-sm', props.compact && 'truncate')}>
      <IconSparkles
        className={cn(
          'mt-0.5 size-3.5 shrink-0',
          props.isError
            ? 'text-red-500 dark:text-red-400'
            : 'text-fuchsia-500 dark:text-fuchsia-400',
        )}
      />
      <span
        className={cn(
          'text-slate-700 dark:text-slate-200',
          props.isError && 'text-red-700 dark:text-red-300',
          props.compact && 'truncate',
        )}
      >
        {props.message}
      </span>
    </div>
  );
}

function ReasoningBlock(props: { text: string; label: I18nText; compact?: boolean }) {
  const segments = useMemo(() => parseReasoningDisplaySegments(props.text), [props.text]);

  if (segments.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Typography variant="xs" color="muted" weight="medium" as="p" text={props.label} />
      <div className="flex flex-col gap-2">
        {segments.map((segment, index) =>
          segment.type === 'sql' ? (
            <SqlCodeBlock
              key={`sql-${index}`}
              sql={segment.content}
              {...(props.compact ? { compact: true } : {})}
            />
          ) : (
            <p
              key={`text-${index}`}
              className={cn(
                'text-sm leading-relaxed text-slate-600 italic dark:text-slate-300',
                props.compact && 'line-clamp-2',
              )}
            >
              {segment.content}
            </p>
          ),
        )}
      </div>
    </div>
  );
}

function renderFeedItem(
  item: FeedItem,
  options: {
    expanded: boolean;
    reasoningLabel: I18nText;
    queryLabel: I18nText;
    queryResultLabel: I18nText;
  },
) {
  switch (item.type) {
    case 'progress':
      return (
        <ProgressLine
          key={item.key}
          message={item.message}
          {...(item.isError ? { isError: true } : {})}
          compact={!options.expanded}
        />
      );
    case 'reasoning':
      return (
        <ReasoningBlock
          key={item.key}
          text={item.text}
          label={options.reasoningLabel}
          compact={!options.expanded}
        />
      );
    case 'query_result':
      return (
        <QueryResultBlock
          key={item.key}
          message={item.message}
          meta={item.meta}
          queryLabel={options.queryLabel}
          resultLabel={options.queryResultLabel}
          compact={!options.expanded}
        />
      );
  }
}

function FeedList(props: {
  items: FeedItem[];
  expanded: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  emptyText: I18nText;
  reasoningLabel: I18nText;
  queryLabel: I18nText;
  queryResultLabel: I18nText;
}) {
  const visibleItems = props.expanded
    ? props.items
    : getPreviewItems(props.items, PREVIEW_PROGRESS_COUNT);

  return (
    <div
      ref={props.scrollRef}
      className={cn(
        'flex flex-col gap-3',
        props.expanded ? 'max-h-96 overflow-y-auto pr-1' : 'overflow-hidden',
      )}
    >
      {visibleItems.length === 0 ? (
        <Typography variant="xs" color="muted" as="p" text={props.emptyText} />
      ) : (
        visibleItems.map((item) =>
          renderFeedItem(item, {
            expanded: props.expanded,
            reasoningLabel: props.reasoningLabel,
            queryLabel: props.queryLabel,
            queryResultLabel: props.queryResultLabel,
          }),
        )
      )}
    </div>
  );
}

type NormalizationRunStatus = WorkspaceProjectionEntry['status'];

const statusCardClasses: Record<NormalizationRunStatus, string> = {
  in_progress:
    'border-fuchsia-200/70 bg-fuchsia-50/40 dark:border-fuchsia-900/50 dark:bg-fuchsia-950/20',
  completed: 'border-slate-200/80 bg-slate-50/60 dark:border-slate-700/80 dark:bg-slate-800/40',
  failed: 'border-red-200/70 bg-red-50/40 dark:border-red-900/50 dark:bg-red-950/20',
  canceled: 'border-slate-200/80 bg-slate-50/60 dark:border-slate-700/80 dark:bg-slate-800/40',
};

export const NormalizationLogFeed = (props: {
  workspaceId: WorkspaceId;
  normalizationRunId: NormalizationRunId;
  status: NormalizationRunStatus;
}) => {
  const { t } = useI18n();
  const isActive = props.status === 'in_progress';
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const { logs } = useNormalizationLogs({
    workspaceId: props.workspaceId,
    normalizationRunId: props.normalizationRunId,
    isActive,
  });
  const feedItems = useMemo(() => buildFeedItems(logs), [logs]);
  const showFeed = isActive || expanded;

  useEffect(() => {
    if (!isActive || !scrollRef.current) {
      return;
    }

    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [feedItems, expanded, isActive]);

  return (
    <Card className={cn('w-full', statusCardClasses[props.status])}>
      <CardContent className={cn('flex w-full flex-col !p-4', showFeed && 'gap-3')}>
        <button
          type="button"
          className="flex w-full items-center gap-2 text-left"
          onClick={() => setExpanded((value) => !value)}
        >
          {isActive ? <Spinner size="xs" /> : null}
          <IconSparkles
            className={cn(
              'size-4 shrink-0',
              isActive
                ? 'text-fuchsia-500 dark:text-fuchsia-400'
                : 'text-slate-500 dark:text-slate-400',
            )}
          />
          <Typography
            variant="sm"
            color={isActive ? 'fuchsia' : 'secondary'}
            weight="medium"
            as="span"
            className={cn(isActive && 'animate-pulse')}
            text={isActive ? t('workspace.normalizing') : t('workspace.logs.title')}
          />
          <Typography
            variant="xs"
            color="muted"
            as="span"
            className="ml-auto shrink-0"
            text={expanded ? t('workspace.logs.hide') : t('workspace.logs.showAll')}
          />
        </button>

        {showFeed ? (
          <FeedList
            items={feedItems}
            expanded={expanded || !isActive}
            scrollRef={scrollRef}
            emptyText={t('workspace.logs.waiting')}
            reasoningLabel={t('workspace.logs.reasoning')}
            queryLabel={t('workspace.logs.query')}
            queryResultLabel={t('workspace.logs.queryResult')}
          />
        ) : null}
      </CardContent>
    </Card>
  );
};
