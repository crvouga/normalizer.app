import { serve, SQL } from "bun";
import { applyDBSchema } from "./db-schema";
import index from "./index.html";
import { Logger } from "./lib/logger";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./lib/routers";
import { createContext } from "./lib/trpc";

const main = async () => {
  const logger = Logger();

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.error("DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  logger.info(`Database URL: ${databaseUrl}`);

  const sql = new SQL(databaseUrl);

  logger.info("Checking database health...");
  try {
    await sql`SELECT 1`;
    logger.info("Database connection successful");
  } catch (error) {
    logger.error("Database connection failed:", error);
    process.exit(1);
  }

  logger.info("Applying database schema...");
  await applyDBSchema({ sql, logger });

  logger.info("Starting server...");
  const server = serve({
    routes: {
      // Serve index.html for all unmatched routes.
      "/*": index,

      // tRPC endpoint
      "/api/trpc/*": async (req) => {
        return fetchRequestHandler({
          endpoint: "/api/trpc",
          req,
          router: appRouter,
          createContext,
        });
      },

      "/api/hello": {
        async GET(req) {
          return Response.json({
            message: "Hello, world!",
            method: "GET",
          });
        },
        async PUT(req) {
          return Response.json({
            message: "Hello, world!",
            method: "PUT",
          });
        },
      },

      "/api/hello/:name": async (req) => {
        const name = req.params.name;
        return Response.json({
          message: `Hello, ${name}!`,
        });
      },

      "/health": async () => {
        return Response.json({ status: "ok" });
      },
    },

    development: process.env.NODE_ENV !== "production",
  });

  logger.info(`🚀 Server running at ${server.url}`);
};

main();
