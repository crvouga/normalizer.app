import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { serve } from "bun";
import index from "./index.html";
import { createLogger } from "./lib/logger";
import { createContext } from "./lib/trpc";
import { createS3 } from "./s3";
import { createSQL } from "./sql";
import { createAppRouter } from "./trpc-app-router";

const main = async () => {
  const logger = createLogger();
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
