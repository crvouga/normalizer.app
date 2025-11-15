import * as React from 'react';
import { cn } from '~/src/lib/cn';
import { toI18nText } from '../../i18n/types';
import { useI18n } from '../../i18n/use-i18n';
import { Typography } from '../typography';

interface TabularFilePreviewTableProps {
  data: Record<string, string | number | boolean | null | undefined>[] | null;
  className?: string;
  maxRows?: number;
  maxColumns?: number;
  isLoading?: boolean;
}

interface TableCellProps {
  children: React.ReactNode;
  isHeader?: boolean;
  title?: string | undefined;
}

const TableCell: React.FC<TableCellProps> = ({ children, isHeader = false, title }) => {
  // If children is a React element (not a string), render it directly
  if (
    React.isValidElement(children) ||
    (typeof children !== 'string' &&
      typeof children !== 'number' &&
      children !== null &&
      children !== undefined)
  ) {
    return (
      <div className="block max-w-[200px] truncate" title={title}>
        {children}
      </div>
    );
  }

  // Convert string/number to I18nText for Typography
  const text = toI18nText(String(children ?? ''));

  if (isHeader) {
    return (
      <Typography
        variant="sm"
        weight="medium"
        color="muted"
        className="block max-w-[200px] truncate"
        title={title}
        text={text}
      />
    );
  }
  return (
    <Typography
      variant="sm"
      color="primary"
      className="block max-w-[200px] truncate"
      title={title}
      text={text}
    />
  );
};

interface TableStructureProps {
  headers: (string | React.ReactNode)[];
  rows: Array<Record<string, unknown>>;
  showFooter: boolean;
  footerContent?: React.ReactNode;
  className?: string | undefined;
}

const TableStructure: React.FC<TableStructureProps> = ({
  headers,
  rows,
  showFooter,
  footerContent,
  className,
}) => {
  return (
    <div className={cn('flex flex-col', className)}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
              {headers.map((header, index) => (
                <th key={index} className="min-w-[200px] p-3 text-left whitespace-nowrap">
                  <TableCell isHeader title={typeof header === 'string' ? header : undefined}>
                    {typeof header === 'string' ? header : header}
                  </TableCell>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="border-b border-slate-200 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700"
              >
                {headers.map((header, colIndex) => {
                  const headerKey = typeof header === 'string' ? header : `col-${colIndex}`;
                  const cellValue = row[headerKey];
                  return (
                    <td key={colIndex} className="min-w-[200px] p-3 whitespace-nowrap">
                      <TableCell title={typeof cellValue === 'string' ? cellValue : undefined}>
                        {typeof cellValue === 'string' ||
                        typeof cellValue === 'number' ||
                        React.isValidElement(cellValue)
                          ? cellValue
                          : null}
                      </TableCell>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showFooter && (
        <div className="flex h-10 items-center justify-center border-t border-slate-200 bg-slate-100 text-center dark:border-slate-700 dark:bg-slate-800">
          {footerContent}
        </div>
      )}
    </div>
  );
};

export const TabularFilePreviewTable: React.FC<TabularFilePreviewTableProps> = ({
  data,
  className,
  maxRows = 10,
  maxColumns = 10,
  isLoading = false,
}) => {
  const { t } = useI18n();

  if (isLoading) {
    const skeletonColumns = 8;
    const skeletonRows = maxRows;

    const skeletonHeaders = Array.from({ length: skeletonColumns }, (_, i) => `col-${i}`);
    const skeletonHeaderNodes = skeletonHeaders.map(() => (
      <span className="inline-block h-3 w-24 animate-pulse rounded bg-slate-300 dark:bg-slate-600" />
    ));
    const skeletonData = Array.from({ length: skeletonRows }, () =>
      skeletonHeaders.reduce(
        (acc, header) => {
          acc[header] = (
            <span className="inline-block h-3 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          );
          return acc;
        },
        {} as Record<string, unknown>,
      ),
    );

    return (
      <TableStructure
        headers={skeletonHeaderNodes}
        rows={skeletonData}
        showFooter={true}
        footerContent={
          <span className="inline-block h-3 w-32 animate-pulse rounded bg-slate-300 dark:bg-slate-600" />
        }
        className={className}
      />
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-100 p-6 text-center dark:border-slate-700 dark:bg-slate-800">
        <Typography variant="sm" color="muted" text={t('tabularFilePreview.noData')} />
      </div>
    );
  }

  // Get headers from first row
  const headers = Object.keys(data[0] ?? {}).slice(0, maxColumns);
  const truncatedData = data.slice(0, maxRows);

  return (
    <TableStructure
      headers={headers}
      rows={truncatedData}
      showFooter={data.length > maxRows}
      footerContent={
        <Typography
          variant="xs"
          color="muted"
          text={
            data.length > maxRows
              ? t('tabularFilePreview.showingRows', {
                  showing: maxRows.toLocaleString(),
                  total: data.length.toLocaleString(),
                })
              : t('tabularFilePreview.noData')
          }
        />
      }
      className={className}
    />
  );
};
