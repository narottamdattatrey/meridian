/**
 * backend/app.ts
 *
 * Express application factory.
 *
 * Responsibilities:
 *  – Security middleware (helmet, CORS)
 *  – Body parsing with a hard size cap
 *  – Route mounting
 *  – Global 404 handler
 *  – Global error handler: the single place that converts any thrown
 *    value (AppError or unknown) into a sanitised HTTP response.
 *    Internal details are logged server-side only; clients receive a
 *    structured JSON error body with no stack traces or DB internals.
 */

import express, {
  Application,
  Request,
  Response,
  NextFunction,
  json,
} from "express";
import cors from "cors";
import helmet from "helmet";
import investorsRouter from "./routes/investors";
import authRouter from "./routes/auth";
import { AppError } from "./lib/AppError";
import { logger } from "./lib/logger";

export function createApp(): Application {
  const app = express();

  // ── Security headers ──────────────────────────────────────────
  app.use(helmet());

  // ── CORS — restrict to known frontend origins ─────────────────
  const allowedOrigins =
    process.env["CORS_ORIGINS"]?.split(",").map((o) => o.trim()) ?? [
      "http://localhost:5173", // Vite dev server
    ];

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow server-to-server / curl calls (no Origin) in non-production.
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`CORS: origin '${origin}' not allowed.`));
        }
      },
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  // ── Body parsing — 64 KB cap prevents large-payload DoS ──────
  app.use(json({ limit: "64kb" }));

  // ── Routes ────────────────────────────────────────────────────
  app.use("/api/auth", authRouter);
  app.use("/api/v1/investors", investorsRouter);

  // ── 404 catch-all ────────────────────────────────────────────
  app.use((_req: Request, res: Response): void => {
    res.status(404).json(
      new AppError(404, "NOT_FOUND", "The requested route does not exist.").toResponse()
    );
  });

  // ── Global error handler ──────────────────────────────────────
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
    if (err instanceof AppError) {
      // Structured, expected errors: log at warn level (no stack needed).
      logger.warn(
        { code: err.code, statusCode: err.statusCode, cause: err.cause },
        err.message
      );
      res.status(err.statusCode).json(err.toResponse());
      return;
    }

    // Truly unexpected errors: log full details server-side only.
    logger.error({ err }, "Unhandled error reached global error handler");

    res
      .status(500)
      .json(AppError.internal(err).toResponse());
  });

  return app;
}
