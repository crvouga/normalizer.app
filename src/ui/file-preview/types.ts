export interface FilePreviewResult {
  data: any[] | null;
  error: string | null;
  isLoading: boolean;
  fileType: string;
}

export type FileType = "csv" | "json" | "excel" | "unsupported";

export interface FileParser {
  parse: (file: File) => Promise<any[]>;
  fileType: FileType;
}
