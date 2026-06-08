import { useEffect, useMemo, useRef, useState } from 'react';
import type { I18nText } from '~/src/i18n/types';
import { useI18n } from '~/src/i18n/use-i18n';
import { cn } from '~/src/lib/cn';
import { Card, CardContent } from '~/src/ui/card';
import { IconSparkles } from '~/src/ui/icons';
import { Spinner } from '~/src/ui/spinner';
import { Typography } from '~/src/ui/typography';
import type { NormalizationRunId } from '../normalization-run-id';
import type { WorkspaceId } from '../workspace-id';
import type { NormalizationLog } from './normalization-log';
import { useNormalizationLogs } from './use-normalization-logs';

const PREVIEW_PROGRESS_COUNT = 2;

type FeedItem =
  | { type: 'progress'; key: string; message: string; isError?: boolean }
  | { type: 'reasoning'; key: string; text: string };

function buildFeedItems(logs: NormalizationLog[]): FeedItem[] {
  const items: FeedItem[] = [];
  let reasoningBuffer = '';
  let reasoningKey: string | null = null;

  const flushReasoning = () => {
    if (reasoningBuffer.length === 0 || reasoningKey === null) {
      return;
    }

    items.push({
      type: 'reasoning',
      key: reasoningKey,
      text: reasoningBuffer,
    });
    reasoningBuffer = '';
    reasoningKey = null;
  };

  for (const log of logs) {
    const kind = log.kind ?? 'progress';

    if (kind === 'reasoning') {
      if (reasoningKey === null) {
        reasoningKey = `reasoning-${log.seq}`;
      }
      reasoningBuffer += log.message;
      continue;
    }

    flushReasoning();

    items.push({
      type: 'progress',
      key: `progress-${log.seq}`,
      message: log.message,
      isError: kind === 'error' || log.level === 'error',
    });
  }

  flushReasoning();
  return items;
}

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
  return (
    <div className="flex flex-col gap-1.5">
      <Typography variant="xs" color="muted" weight="medium" as="p" text={props.label} />
      <p
        className={cn(
          'text-sm leading-relaxed text-slate-600 italic dark:text-slate-300',
          props.compact && 'line-clamp-2',
        )}
      >
        {props.text}
      </p>
    </div>
  );
}

function FeedList(props: {
  items: FeedItem[];
  expanded: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  emptyText: I18nText;
  reasoningLabel: I18nText;
}) {
  const visibleItems = props.expanded
    ? props.items
    : (() => {
        const progressItems = props.items.filter((item) => item.type === 'progress');
        const reasoningItems = props.items.filter((item) => item.type === 'reasoning');
        const previewProgress = progressItems.slice(
          Math.max(0, progressItems.length - PREVIEW_PROGRESS_COUNT),
        );
        const previewReasoning =
          reasoningItems.length > 0 ? [reasoningItems[reasoningItems.length - 1]!] : [];

        return [...previewProgress, ...previewReasoning];
      })();

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
          item.type === 'progress' ? (
            <ProgressLine
              key={item.key}
              message={item.message}
              {...(item.isError ? { isError: true } : {})}
              compact={!props.expanded}
            />
          ) : (
            <ReasoningBlock
              key={item.key}
              text={item.text}
              label={props.reasoningLabel}
              compact={!props.expanded}
            />
          ),
        )
      )}
    </div>
  );
}

export const NormalizationLogFeed = (props: {
  workspaceId: WorkspaceId;
  normalizationRunId: NormalizationRunId;
}) => {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const { logs } = useNormalizationLogs({
    workspaceId: props.workspaceId,
    normalizationRunId: props.normalizationRunId,
  });
  const feedItems = useMemo(() => buildFeedItems(logs), [logs]);

  useEffect(() => {
    if (!scrollRef.current) {
      return;
    }

    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [feedItems, expanded]);

  return (
    <Card className="w-full border-fuchsia-200/70 bg-fuchsia-50/40 dark:border-fuchsia-900/50 dark:bg-fuchsia-950/20">
      <CardContent className="flex flex-col gap-3 p-4">
        <button
          type="button"
          className="flex w-full items-center gap-2 text-left"
          onClick={() => setExpanded((value) => !value)}
        >
          <Spinner size="xs" />
          <IconSparkles className="size-4 text-fuchsia-500 dark:text-fuchsia-400" />
          <Typography
            variant="sm"
            color="fuchsia"
            weight="medium"
            as="span"
            className="animate-pulse"
            text={t('workspace.normalizing')}
          />
          <Typography
            variant="xs"
            color="muted"
            as="span"
            className="ml-auto"
            text={expanded ? t('workspace.logs.hide') : t('workspace.logs.showAll')}
          />
        </button>

        <FeedList
          items={feedItems}
          expanded={expanded}
          scrollRef={scrollRef}
          emptyText={t('workspace.logs.waiting')}
          reasoningLabel={t('workspace.logs.reasoning')}
        />
      </CardContent>
    </Card>
  );
};
