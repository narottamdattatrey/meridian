/**
 * backend/server.ts
 *
 * Entry point. Starts the HTTP server and manages graceful shutdown,
 * including draining the pg connection pool before process exit.
 */

import { createApp } from "./app";
import { closePool } from "./db/pool";
import { logger } from "./lib/logger";

const PORT = parseInt(process.env["PORT"] ?? "4000", 10);

const app = createApp();

const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, "Meridian API server started");
});

// ── Graceful shutdown ────────────────────────────────────────
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Shutdown signal received – draining connections");

  server.close(async () => {
    try {
      await closePool();
      logger.info("Shutdown complete");
      process.exit(0);
    } catch (err: unknown) {
      logger.error({ err }, "Error during shutdown");
      process.exit(1);
    }
  });

  // Force-kill if in-flight requests don't drain within 15 s.
  setTimeout(() => {
    logger.error("Forced shutdown after 15 s timeout");
    process.exit(1);
  }, 15_000).unref();
}

process.on("SIGTERM", () => { void shutdown("SIGTERM"); });
process.on("SIGINT",  () => { void shutdown("SIGINT"); });
