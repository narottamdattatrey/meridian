/**
 * backend/db/pool.ts
 *
 * Singleton `pg.Pool` configured entirely from environment variables.
 *
 * Environment variables (all optional – defaults shown):
 *   DATABASE_URL          Full connection string (overrides individual vars)
 *   DB_HOST               localhost
 *   DB_PORT               5432
 *   DB_NAME               meridian
 *   DB_USER               postgres
 *   DB_PASSWORD           (required if not using DATABASE_URL)
 *   DB_POOL_MIN           2
 *   DB_POOL_MAX           10
 *   DB_STATEMENT_TIMEOUT  30000  (ms – prevents runaway queries)
 *   DB_SSL                false  (set to "true" in production)
 *
 * Usage:
 *   import { pool } from './pool';
 *   const result = await pool.query<MyRow>('SELECT …', [param]);
 */

import { Pool, PoolConfig, DatabaseError } from "pg";
import { logger } from "../lib/logger";

// ─────────────────────────────────────────────────────────────
//  Build PoolConfig from environment
// ─────────────────────────────────────────────────────────────

function buildPoolConfig(): PoolConfig {
  const statementTimeout = parseInt(
    process.env["DB_STATEMENT_TIMEOUT"] ?? "30000",
    10
  );

  const sslEnabled = process.env["DB_SSL"] === "true";

  const base: PoolConfig = {
    min: parseInt(process.env["DB_POOL_MIN"] ?? "2", 10),
    max: parseInt(process.env["DB_POOL_MAX"] ?? "10", 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: statementTimeout,
    ssl: sslEnabled ? { rejectUnauthorized: true } : false,
  };

  if (process.env["DATABASE_URL"]) {
    return { ...base, connectionString: process.env["DATABASE_URL"] };
  }

  return {
    ...base,
    host: process.env["DB_HOST"] ?? "localhost",
    port: parseInt(process.env["DB_PORT"] ?? "5432", 10),
    database: process.env["DB_NAME"] ?? "meridian",
    user: process.env["DB_USER"] ?? "postgres",
    password: process.env["DB_PASSWORD"],
  };
}

// ─────────────────────────────────────────────────────────────
//  Singleton pool
// ─────────────────────────────────────────────────────────────

export const pool = new Pool(buildPoolConfig());

// Surface pool-level errors (e.g. broken idle connections) without
// crashing the process – pg emits these on the Pool instance itself.
pool.on("error", (err: Error) => {
  logger.error({ err }, "pg.Pool idle client error");
});

// ─────────────────────────────────────────────────────────────
//  Type guard for pg DatabaseError
//  (avoids importing the class just for instanceof checks)
// ─────────────────────────────────────────────────────────────

export interface PgDatabaseError {
  code: string;
  constraint?: string;
  detail?: string;
  table?: string;
}

export function isPgDatabaseError(err: unknown): err is PgDatabaseError {
  return err instanceof DatabaseError;
}

// ─────────────────────────────────────────────────────────────
//  Well-known PostgreSQL error codes used by the repository
// ─────────────────────────────────────────────────────────────

export const PG_ERROR = {
  UNIQUE_VIOLATION: "23505",
  CHECK_VIOLATION: "23514",
  NOT_NULL_VIOLATION: "23502",
  INVALID_TEXT_REPRESENTATION: "22P02",  // e.g. malformed UUID
  STRING_DATA_RIGHT_TRUNCATION: "22001", // value too long for column
} as const;

// ─────────────────────────────────────────────────────────────
//  Graceful shutdown helper (call from server.ts)
// ─────────────────────────────────────────────────────────────

export async function closePool(): Promise<void> {
  await pool.end();
  logger.info("pg.Pool closed");
}
