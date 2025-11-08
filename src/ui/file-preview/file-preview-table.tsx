import * as React from 'react';
import { cn } from '~/src/lib/utils';
import { Typography } from '../typography';

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
      <div className="rounded-lg border border-gray-200 bg-gray-100 p-6 text-center dark:border-gray-700 dark:bg-gray-800">
        <Typography variant="sm" color="muted">
          No data to preview
        </Typography>
      </div>
    );
  }

  // Get headers from first row
  const headers = Object.keys(data[0]).slice(0, maxColumns);
  const truncatedData = data.slice(0, maxRows);

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800">
              {headers.map((header, index) => (
                <th key={index} className="min-w-0 p-3 text-left whitespace-nowrap">
                  <Typography
                    variant="sm"
                    weight="medium"
                    color="muted"
                    className="block max-w-[200px] truncate"
                    title={header}
                  >
                    {header}
                  </Typography>
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
                    <Typography
                      variant="sm"
                      color="primary"
                      className="block max-w-[200px] truncate"
                      title={String(row[header])}
                    >
                      {String(row[header])}
                    </Typography>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length > maxRows && (
        <div className="border-t border-gray-200 bg-gray-100 p-3 text-center dark:border-gray-700 dark:bg-gray-800">
          <Typography variant="xs" color="muted">
            Showing {maxRows} of {data.length} rows
          </Typography>
        </div>
      )}
    </div>
  );
};
