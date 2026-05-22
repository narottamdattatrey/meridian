/**
 * backend/lib/logger.ts
 *
 * Structured logger built on pino.
 *
 * Behaviour:
 *   NODE_ENV=production  → JSON lines to stdout (machine-parseable, ideal
 *                          for log aggregation pipelines like Datadog / ELK).
 *   anything else        → pino-pretty human-readable output for local dev.
 *
 * Child loggers carry request-scoped context (requestId, route) and should
 * be created per-request:
 *
 *   const reqLogger = logger.child({ requestId: req.id, route: req.path });
 *   reqLogger.info('investor created');
 */

import pino, { Logger } from "pino";

const isProduction = process.env["NODE_ENV"] === "production";

export const logger: Logger = pino(
  {
    level: process.env["LOG_LEVEL"] ?? (isProduction ? "info" : "debug"),
    // Redact PII fields that may appear in error objects or request bodies.
    // pino replaces the value with '[Redacted]' rather than omitting the key,
    // so log structure remains predictable.
    redact: {
      paths: [
        "email",
        "body.email",
        "req.body.email",
        "*.email",
        "password",
        "*.password",
      ],
      censor: "[Redacted]",
    },
    serializers: {
      err: pino.stdSerializers.err,
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
    },
    // ISO timestamp instead of epoch ms – easier to read in raw logs.
    timestamp: pino.stdTimeFunctions.isoTime,
    base: {
      service: "meridian-api",
      env: process.env["NODE_ENV"] ?? "development",
    },
  },
  // In non-production, use pino-pretty if available; fall back to stdout.
  isProduction
    ? pino.destination(1)
    : pino.transport({
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:HH:MM:ss.l",
          ignore: "pid,hostname,service,env",
        },
      })
);
