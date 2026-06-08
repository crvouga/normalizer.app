import { useEffect, useRef, useState } from 'react';
import { useI18n } from '~/src/i18n/use-i18n';
import { cn } from '~/src/lib/cn';
import { Card, CardContent } from '~/src/ui/card';
import { IconSparkles } from '~/src/ui/icons';
import { Spinner } from '~/src/ui/spinner';
import { Typography } from '~/src/ui/typography';
import type { NormalizationRunId } from '../normalization-run-id';
import type { WorkspaceId } from '../workspace-id';
import type { NormalizationLog, NormalizationLogLevel } from './normalization-log';
import { useNormalizationLogs } from './use-normalization-logs';

const PREVIEW_LINE_COUNT = 3;

const levelColorClasses: Record<NormalizationLogLevel, string> = {
  error: 'text-red-600 dark:text-red-400',
  warn: 'text-amber-600 dark:text-amber-400',
  info: 'text-cyan-700 dark:text-cyan-300',
  debug: 'text-slate-500 dark:text-slate-400',
};

function formatMeta(meta: Record<string, unknown> | undefined): string | null {
  if (!meta) {
    return null;
  }

  if (typeof meta.content === 'string') {
    return meta.content;
  }

  if (typeof meta.query === 'string') {
    return meta.query;
  }

  const serialized = JSON.stringify(meta, null, 2);
  return serialized === '{}' ? null : serialized;
}

function LogLine(props: { log: NormalizationLog; compact?: boolean }) {
  const metaText = formatMeta(props.log.meta);

  return (
    <div className={cn('font-mono text-xs leading-relaxed', props.compact && 'truncate')}>
      <span className={cn('font-medium', levelColorClasses[props.log.level])}>
        [{props.log.scope || 'app'}]{' '}
      </span>
      <span className="text-slate-700 dark:text-slate-200">{props.log.message}</span>
      {metaText && !props.compact ? (
        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-slate-100 p-2 text-[11px] text-slate-700 dark:bg-slate-900 dark:text-slate-300">
          {metaText}
        </pre>
      ) : null}
    </div>
  );
}

function LogList(props: {
  logs: NormalizationLog[];
  expanded: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const visibleLogs = props.expanded
    ? props.logs
    : props.logs.slice(Math.max(0, props.logs.length - PREVIEW_LINE_COUNT));

  return (
    <div
      ref={props.scrollRef}
      className={cn(
        'flex flex-col gap-2',
        props.expanded ? 'max-h-96 overflow-y-auto pr-1' : 'overflow-hidden',
      )}
    >
      {visibleLogs.length === 0 ? (
        <Typography
          variant="xs"
          color="muted"
          as="p"
          text="Waiting for normalization activity..."
        />
      ) : (
        visibleLogs.map((log) => <LogLine key={log.seq} log={log} compact={!props.expanded} />)
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

  useEffect(() => {
    if (!scrollRef.current) {
      return;
    }

    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [logs, expanded]);

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

        <LogList logs={logs} expanded={expanded} scrollRef={scrollRef} />
      </CardContent>
    </Card>
  );
};
