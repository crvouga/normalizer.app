import * as React from "react";
import { cn } from "~/src/lib/utils";

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
      <div className="text-sm text-muted-foreground p-6 text-center border rounded-lg bg-muted/20">
        No data to preview
      </div>
    );
  }

  // Get headers from first row
  const headers = Object.keys(data[0]).slice(0, maxColumns);
  const truncatedData = data.slice(0, maxRows);

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm min-w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              {headers.map((header, index) => (
                <th
                  key={index}
                  className="p-3 text-left font-medium text-muted-foreground whitespace-nowrap min-w-0"
                >
                  <div className="truncate max-w-[200px]" title={header}>
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
                className="border-b transition-colors hover:bg-muted/30"
              >
                {headers.map((header, colIndex) => (
                  <td key={colIndex} className="p-3 whitespace-nowrap min-w-0">
                    <div
                      className="truncate max-w-[200px] text-foreground"
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
        <div className="text-xs text-muted-foreground p-3 text-center bg-muted/20 border-t">
          Showing {maxRows} of {data.length} rows
        </div>
      )}
    </div>
  );
};
