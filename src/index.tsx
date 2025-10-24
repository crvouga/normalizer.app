import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { serve } from "bun";
import { createLogger } from "./lib/logger";
import { createContext } from "./lib/trpc";
import { createS3 } from "./s3";
import { createSQL, cleanupSQL } from "./sql";
import { createAppRouter } from "./trpc-app-router";

const main = async () => {
  const logger = createLogger();

  // Setup graceful shutdown handlers
  const setupGracefulShutdown = () => {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      await cleanupSQL(logger);
      process.exit(0);
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGHUP", () => shutdown("SIGHUP"));
  };

  setupGracefulShutdown();

  const sql = await createSQL({ logger });
  const s3 = await createS3({ logger });
  const appRouter = createAppRouter({
    sql,
    s3,
    logger,
  });

  logger.info("Starting server...");
  const server = serve({
    routes: {
      // Serve index.html for all unmatched routes.
      "/*": async (req) => {
        // Serve the HTML file directly
        const htmlFile = Bun.file("./src/index.html");
        return new Response(htmlFile, {
          headers: {
            "Content-Type": "text/html",
          },
        });
      },

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

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
