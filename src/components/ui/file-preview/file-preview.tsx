import * as React from "react";
import { cn } from "~/src/lib/utils";

interface TablePreviewProps {
  data: any[] | null;
  className?: string;
  maxRows?: number;
  maxColumns?: number;
}

const TablePreview: React.FC<TablePreviewProps> = ({
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
    <div className={cn("overflow-x-auto border rounded-lg", className)}>
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
      {data.length > maxRows && (
        <div className="text-xs text-muted-foreground p-3 text-center bg-muted/20 border-t">
          Showing {maxRows} of {data.length} rows
        </div>
      )}
    </div>
  );
};

interface FilePreviewProps {
  file: File;
  className?: string;
  maxRows?: number;
  maxColumns?: number;
}

export const FilePreview: React.FC<FilePreviewProps> = ({
  file,
  className,
  maxRows = 10,
  maxColumns = 10,
}) => {
  const [data, setData] = React.useState<any[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const parseFile = async () => {
      try {
        const text = await file.text();
        let parsedData: any[] = [];

        if (file.name.endsWith(".csv")) {
          // Parse CSV
          const rows = text.split("\n");
          const headers = rows[0].split(",").map((h) => h.trim());
          parsedData = rows.slice(1).map((row) => {
            const values = row.split(",");
            return headers.reduce((obj, header, index) => {
              obj[header] = values[index]?.trim() || "";
              return obj;
            }, {} as any);
          });
        } else if (file.name.endsWith(".json")) {
          // Parse JSON
          const jsonData = JSON.parse(text);
          if (Array.isArray(jsonData)) {
            parsedData = jsonData;
          } else {
            throw new Error("JSON must be an array of objects");
          }
        } else if (
          file.type ===
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
          file.type === "application/vnd.ms-excel"
        ) {
          // For Excel files, you might want to use a library like xlsx
          // This is just a placeholder
          throw new Error("Excel preview not implemented");
        } else {
          throw new Error("Unsupported file type");
        }

        setData(parsedData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse file");
        setData(null);
      }
    };

    parseFile();
  }, [file]);

  if (error) {
    return (
      <div className="text-sm text-destructive p-6 text-center border rounded-lg bg-destructive/10 border-destructive/20">
        {error}
      </div>
    );
  }

  return (
    <TablePreview
      data={data}
      className={className}
      maxRows={maxRows}
      maxColumns={maxColumns}
    />
  );
};
