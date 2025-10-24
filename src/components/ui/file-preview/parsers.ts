import type { FileType } from "./types";

export const parseCSV = async (file: File): Promise<any[]> => {
  const text = await file.text();
  const rows = text.split("\n");
  const headers = rows[0].split(",").map((h) => h.trim());
  return rows.slice(1).map((row) => {
    const values = row.split(",");
    return headers.reduce((obj, header, index) => {
      obj[header] = values[index]?.trim() || "";
      return obj;
    }, {} as any);
  });
};

export const parseJSON = async (file: File): Promise<any[]> => {
  const text = await file.text();
  const jsonData = JSON.parse(text);

  if (Array.isArray(jsonData)) {
    return jsonData;
  } else {
    throw new Error("JSON must be an array of objects");
  }
};

export const parseExcel = async (file: File): Promise<any[]> => {
  // For Excel files, you might want to use a library like xlsx
  // This is just a placeholder implementation
  throw new Error("Excel preview not implemented - requires xlsx library");
};

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
