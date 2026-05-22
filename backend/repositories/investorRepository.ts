/**
 * backend/repositories/investorRepository.ts
 *
 * All SQL that touches the `investors` table lives here.
 *
 * Rules enforced in this file:
 *  – Every query uses positional parameters ($1, $2 …) — never string
 *    interpolation — to prevent SQL injection.
 *  – Return types are explicitly asserted on pg's QueryResult<T> so the
 *    compiler enforces that callers get a fully-typed InvestorRecord.
 *  – DatabaseError interception maps pg error codes to AppErrors so the
 *    route layer never needs to know about pg internals.
 *  – No `any` — `pg` types are used directly or via the PgDatabaseError
 *    type guard exported from pool.ts.
 */

import type { QueryResult } from "pg";
import { pool, isPgDatabaseError, PG_ERROR } from "../db/pool";
import { AppError } from "../lib/AppError";
import { logger } from "../lib/logger";
import type { InvestorRecord, CreateInvestorInput } from "../types/domain";

// ─────────────────────────────────────────────────────────────
//  INSERT – create a new investor
// ─────────────────────────────────────────────────────────────

/**
 * Inserts a validated investor record and returns the full persisted row.
 *
 * @throws {AppError} 409 DUPLICATE_EMAIL if the email already exists.
 * @throws {AppError} 500 INTERNAL_ERROR   for any other DB failure.
 */
export async function createInvestor(
  input: CreateInvestorInput
): Promise<InvestorRecord> {
  const sql = `
    INSERT INTO investors (full_name, email, date_of_birth, country)
    VALUES ($1, $2, $3, $4)
    RETURNING
      id,
      full_name,
      email,
      date_of_birth :: TEXT  AS date_of_birth,
      country,
      status,
      created_at :: TEXT     AS created_at,
      updated_at :: TEXT     AS updated_at
  `;

  const params: [string, string, string, string] = [
    input.full_name,
    input.email,      // already lowercased by Zod transform
    input.date_of_birth,
    input.country,
  ];

  try {
    const result: QueryResult<InvestorRecord> = await pool.query<InvestorRecord>(
      sql,
      params
    );

    const row = result.rows[0];
    if (row === undefined) {
      // Should never happen after a successful INSERT … RETURNING, but
      // guard defensively to keep the return type non-nullable.
      throw AppError.internal(new Error("INSERT RETURNING returned no rows"));
    }

    logger.info(
      { investorId: row.id, country: row.country },
      "investor.created"
    );

    return row;
  } catch (err: unknown) {
    if (isPgDatabaseError(err)) {
      if (err.code === PG_ERROR.UNIQUE_VIOLATION) {
        // The functional unique index on LOWER(email) fires here.
        throw AppError.duplicateEmail();
      }

      if (err.code === PG_ERROR.CHECK_VIOLATION) {
        // A DB-level CHECK constraint fired (e.g. dob 18+ or country format).
        // This should never reach production if Zod validates first, but we
        // surface it as a 400 rather than a 500 to aid debugging.
        logger.warn({ constraint: err.constraint }, "investor.createCheckViolation");
        throw new AppError(
          400,
          "CONSTRAINT_VIOLATION",
          `Database constraint violated: ${err.constraint ?? "unknown"}.`,
          { cause: err }
        );
      }
    }

    logger.error({ err }, "investor.createUnexpectedError");
    throw AppError.internal(err);
  }
}

// ─────────────────────────────────────────────────────────────
//  SELECT BY ID
// ─────────────────────────────────────────────────────────────

/**
 * Fetches a single investor by UUID primary key.
 *
 * Returns `null` when the row is not found (let the route layer decide
 * the HTTP status — keeps the repository transport-agnostic).
 *
 * @throws {AppError} 500 INTERNAL_ERROR for unexpected DB failures.
 */
export async function findInvestorById(
  id: string
): Promise<InvestorRecord | null> {
  const sql = `
    SELECT
      id,
      full_name,
      email,
      date_of_birth :: TEXT  AS date_of_birth,
      country,
      status,
      created_at :: TEXT     AS created_at,
      updated_at :: TEXT     AS updated_at
    FROM investors
    WHERE id = $1
    LIMIT 1
  `;

  try {
    const result: QueryResult<InvestorRecord> = await pool.query<InvestorRecord>(
      sql,
      [id]
    );

    return result.rows[0] ?? null;
  } catch (err: unknown) {
    if (isPgDatabaseError(err) && err.code === PG_ERROR.INVALID_TEXT_REPRESENTATION) {
      // pg raises 22P02 when a non-UUID string is cast to uuid internally.
      // The route layer validates UUID format via Zod before this call,
      // so this path is a belt-and-suspenders catch.
      throw AppError.invalidUuid("id");
    }

    logger.error({ err, investorId: id }, "investor.findByIdUnexpectedError");
    throw AppError.internal(err);
  }
}
