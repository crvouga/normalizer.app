import { AlertCircle, Check } from 'lucide-react';
import type { I18nText } from '~/src/i18n/types';
import { useI18n } from '~/src/i18n/use-i18n';
import { cn } from '~/src/lib/cn';
import { TabularFilePreviewTable } from '~/src/ui/tabular-file-preview/tabular-file-preview-table';
import { Typography } from '~/src/ui/typography';
import type { QueryResultLogMeta } from './query-result-log-meta';
import { SqlCodeBlock } from './sql-code-block';

function QueryHeader(props: { query?: string; queryLabel: I18nText; compact?: boolean }) {
  if (!props.query) {
    return null;
  }

  return (
    <div className="flex flex-col gap-0.5">
      <Typography variant="xs" color="muted" weight="medium" as="p" text={props.queryLabel} />
      <SqlCodeBlock
        sql={props.query}
        dense
        {...(props.compact ? { compact: true } : {})}
      />
    </div>
  );
}

export const QueryResultBlock = (props: {
  message: string;
  meta: QueryResultLogMeta;
  queryLabel: I18nText;
  resultLabel: I18nText;
  compact?: boolean;
}) => {
  const { t } = useI18n();

  if (props.meta.resultType === 'rows') {
    const tableData = (props.meta.rows ?? []) as Record<
      string,
      string | number | boolean | null | undefined
    >[];

    return (
      <div className="flex flex-col gap-1">
        <QueryHeader
          {...(props.meta.query !== undefined ? { query: props.meta.query } : {})}
          queryLabel={props.queryLabel}
          {...(props.compact ? { compact: true } : {})}
        />
        <div className="flex flex-col gap-0.5">
          <Typography variant="xs" color="muted" weight="medium" as="p" text={props.resultLabel} />
          <div className={cn('overflow-x-auto', props.compact && 'max-h-24 overflow-y-hidden')}>
            <TabularFilePreviewTable
              data={tableData}
              dense
              readOnly
              maxRows={props.compact ? 3 : 10}
              maxColumns={10}
            />
          </div>
        </div>
      </div>
    );
  }

  if (props.meta.resultType === 'command') {
    return (
      <div className="flex flex-col gap-1">
        <QueryHeader
          {...(props.meta.query !== undefined ? { query: props.meta.query } : {})}
          queryLabel={props.queryLabel}
          {...(props.compact ? { compact: true } : {})}
        />
        <div className="flex items-start gap-1.5 text-xs">
          <Check className="mt-0.5 size-3 shrink-0 text-green-600 dark:text-green-400" />
          <span className="text-slate-600 dark:text-slate-300">
            {t('workspace.logs.commandCompleted', {
              count: String(props.meta.rowCount ?? 0),
            })}
          </span>
        </div>
      </div>
    );
  }

  if (props.meta.resultType === 'error') {
    return (
      <div className="flex flex-col gap-1">
        <QueryHeader
          {...(props.meta.query !== undefined ? { query: props.meta.query } : {})}
          queryLabel={props.queryLabel}
          {...(props.compact ? { compact: true } : {})}
        />
        <div className="flex items-start gap-1.5 text-xs">
          <AlertCircle className="mt-0.5 size-3 shrink-0 text-red-500 dark:text-red-400" />
          <span className="text-red-700 dark:text-red-300">
            {t('workspace.logs.queryError', {
              error: props.meta.error ?? props.message,
            })}
          </span>
        </div>
      </div>
    );
  }

  const rawText =
    props.meta.rawResult !== undefined
      ? JSON.stringify(props.meta.rawResult, null, 2)
      : props.message;

  return (
    <div className="flex flex-col gap-1">
      <QueryHeader
        {...(props.meta.query !== undefined ? { query: props.meta.query } : {})}
        queryLabel={props.queryLabel}
        {...(props.compact ? { compact: true } : {})}
      />
      <div className="flex flex-col gap-0.5">
        <Typography variant="xs" color="muted" weight="medium" as="p" text={props.resultLabel} />
        <pre
          className={cn(
            'overflow-x-auto rounded border border-slate-200 bg-slate-50 p-1 font-mono text-[0.625rem] leading-tight text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200',
            props.compact && 'line-clamp-3',
          )}
        >
          {rawText}
        </pre>
      </div>
    </div>
  );
};
