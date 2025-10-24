import type { FileType } from "../types";

export const getFileType = (file: File): FileType => {
  if (file.name.endsWith(".csv")) return "csv";
  if (file.name.endsWith(".json")) return "json";
  if (
    file.type ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.type === "application/vnd.ms-excel"
  ) {
    return "excel";
  }
  return "unsupported";
};
