import { serve, SQL } from "bun";
import { applyDBSchema } from "./db-schema";
import index from "./index.html";
import { Logger } from "./lib/logger";

const logger = Logger();

const sql = new SQL();

logger.info("Applying database schema...");
applyDBSchema(sql, logger);

logger.info("Starting server...");
const server = serve({
  routes: {
    // Serve index.html for all unmatched routes.
    "/*": index,

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
