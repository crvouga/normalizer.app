import * as React from 'react';
import { cn } from '~/src/lib/utils';

interface FilePreviewTableProps {
  data: any[] | null;
  className?: string;
  maxRows?: number;
  maxColumns?: number;
}

export const FilePreviewTable: React.FC<FilePreviewTableProps> = ({
  data,
  className,
  maxRows = 10,
  maxColumns = 10,
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-100 p-6 text-center text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
        No data to preview
      </div>
    );
  }

  // Get headers from first row
  const headers = Object.keys(data[0]).slice(0, maxColumns);
  const truncatedData = data.slice(0, maxRows);

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800">
              {headers.map((header, index) => (
                <th
                  key={index}
                  className="min-w-0 p-3 text-left font-medium whitespace-nowrap text-gray-600 dark:text-gray-400"
                >
                  <div className="max-w-[200px] truncate" title={header}>
                    {header}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {truncatedData.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="border-b border-gray-200 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
              >
                {headers.map((header, colIndex) => (
                  <td key={colIndex} className="min-w-0 p-3 whitespace-nowrap">
                    <div
                      className="max-w-[200px] truncate text-gray-900 dark:text-gray-100"
                      title={String(row[header])}
                    >
                      {String(row[header])}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length > maxRows && (
        <div className="border-t border-gray-200 bg-gray-100 p-3 text-center text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
          Showing {maxRows} of {data.length} rows
        </div>
      )}
    </div>
  );
};
