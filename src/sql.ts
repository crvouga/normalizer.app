import { SQL } from "bun";
import type { Logger } from "./lib/logger";
import { SQL_SCHEMA } from "./sql-schema";

export const createSQL = async ({
  logger,
}: {
  logger: Logger;
}): Promise<SQL> => {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    logger.error("DATABASE_URL environment variable is not set");
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const sql = new SQL(databaseUrl);

  logger.info("Checking database health...");
  try {
    await sql`SELECT 1`;
    logger.info("Database connection successful");
  } catch (error) {
    logger.error("Database connection failed:", error);
    throw new Error("Failed to connect to database");
  }

  await applySqlSchema({ sql, logger });

  return sql;
};

const applySqlSchema = async ({
  sql,
  logger,
}: {
  sql: SQL;
  logger: Logger;
}): Promise<void> => {
  logger.info("Applying database schema...");
  try {
    await sql.unsafe(SQL_SCHEMA);
    logger.info("Successfully applied database schema");
  } catch (error) {
    logger.error("Failed to apply database schema", { error });
    throw error;
  }
};
