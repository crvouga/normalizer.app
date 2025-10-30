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
      <div className="text-muted-foreground bg-muted/20 rounded-lg border p-6 text-center text-sm">
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
            <tr className="bg-muted/50 border-b">
              {headers.map((header, index) => (
                <th
                  key={index}
                  className="text-muted-foreground min-w-0 p-3 text-left font-medium whitespace-nowrap"
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
              <tr key={rowIndex} className="hover:bg-muted/30 border-b transition-colors">
                {headers.map((header, colIndex) => (
                  <td key={colIndex} className="min-w-0 p-3 whitespace-nowrap">
                    <div
                      className="text-foreground max-w-[200px] truncate"
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
        <div className="text-muted-foreground bg-muted/20 border-t p-3 text-center text-xs">
          Showing {maxRows} of {data.length} rows
        </div>
      )}
    </div>
  );
};
