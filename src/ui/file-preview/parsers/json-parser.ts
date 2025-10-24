import type { FileType } from "../types";

export const parseJSON = async (
  file: File
): Promise<Record<string, unknown>[]> => {
  const text = await file.text();
  const jsonData = JSON.parse(text);

  if (Array.isArray(jsonData)) {
    // Ensure all items in the array are objects
    return jsonData.filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null && !Array.isArray(item)
    );
  } else {
    throw new Error("JSON must be an array of objects");
  }
};

export const getJSONFileType = (): FileType => "json";
