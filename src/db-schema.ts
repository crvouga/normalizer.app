import { SQL } from "bun";
import { FILE_UPLOAD_DB_SCHEMA } from "./file-upload/file-upload-db-schema";
import { Logger } from "./lib/logger";

export const DB_SCHEMA = `
${FILE_UPLOAD_DB_SCHEMA}
`;

export const applyDBSchema = async (
  sql: SQL,
  logger: Logger
): Promise<void> => {
  logger.info("Applying database schema...");
  try {
    await sql.unsafe(DB_SCHEMA);
    logger.info("Successfully applied database schema");
  } catch (error) {
    logger.error("Failed to apply database schema", { error });
    throw error;
  }
};
