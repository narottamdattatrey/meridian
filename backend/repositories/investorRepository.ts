/**
 * backend/repositories/investorRepository.ts
 *
 * Data access layer for the `investors` table.
 *
 * Architecture notes:
 *  – `IInvestorRepository` is the dependency-inversion interface.
 *    The service layer and tests depend on this interface, never on the
 *    concrete class directly.
 *  – `PgInvestorRepository` is the production implementation backed by
 *    the pg connection pool.
 *  – All SQL uses positional parameters ($1…$n) — zero string interpolation
 *    — to prevent SQL injection by construction.
 *  – pg's `QueryResult<T>` is used with an explicit type parameter so the
 *    TypeScript compiler enforces the returned row shape.
 *  – pg error codes are intercepted here and mapped to typed `AppError`
 *    instances; the service and route layers never inspect pg internals.
 */

import type { QueryResult } from "pg";
import { pool, isPgDatabaseError, PG_ERROR } from "../db/pool";
import { AppError } from "../lib/AppError";
import { logger } from "../lib/logger";
import type { InvestorRecord, CreateInvestorInput } from "@meridian/shared";

// ─────────────────────────────────────────────────────────────
//  Repository contract
//  Depend on this interface, not on PgInvestorRepository directly.
// ─────────────────────────────────────────────────────────────

export interface IInvestorRepository {
  /**
   * Persists a new investor and returns the full DB-generated record.
   * @throws {AppError} 409 DUPLICATE_EMAIL on unique constraint violation.
   * @throws {AppError} 400 CONSTRAINT_VIOLATION on other CHECK failures.
   * @throws {AppError} 500 INTERNAL_ERROR on unexpected failures.
   */
  create(input: CreateInvestorInput): Promise<InvestorRecord>;

  /**
   * Finds an investor by UUID primary key.
   * Returns `null` when the row does not exist (route layer owns 404).
   * @throws {AppError} 500 INTERNAL_ERROR on unexpected failures.
   */
  findById(id: string): Promise<InvestorRecord | null>;
}

// ─────────────────────────────────────────────────────────────
//  Production implementation (PostgreSQL via pg.Pool)
// ─────────────────────────────────────────────────────────────

export class PgInvestorRepository implements IInvestorRepository {
  async create(input: CreateInvestorInput): Promise<InvestorRecord> {
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

    // Zod's .toLowerCase() transform has already normalised the email.
    const params: [string, string, string, string] = [
      input.full_name,
      input.email,
      input.date_of_birth,
      input.country,
    ];

    try {
      const result: QueryResult<InvestorRecord> =
        await pool.query<InvestorRecord>(sql, params);

      const row = result.rows[0];
      if (row === undefined) {
        throw AppError.internal(
          new Error("INSERT … RETURNING returned no rows unexpectedly")
        );
      }

      return row;
    } catch (err: unknown) {
      if (isPgDatabaseError(err)) {
        if (err.code === PG_ERROR.UNIQUE_VIOLATION) {
          throw AppError.duplicateEmail();
        }

        if (err.code === PG_ERROR.CHECK_VIOLATION) {
          logger.warn(
            { constraint: err.constraint },
            "investor.repository.checkViolation"
          );
          throw new AppError(
            400,
            "CONSTRAINT_VIOLATION",
            `Database constraint violated: ${err.constraint ?? "unknown"}.`,
            { cause: err }
          );
        }
      }

      logger.error({ err }, "investor.repository.createError");
      throw AppError.internal(err);
    }
  }

  async findById(id: string): Promise<InvestorRecord | null> {
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
      const result: QueryResult<InvestorRecord> =
        await pool.query<InvestorRecord>(sql, [id]);

      return result.rows[0] ?? null;
    } catch (err: unknown) {
      if (
        isPgDatabaseError(err) &&
        err.code === PG_ERROR.INVALID_TEXT_REPRESENTATION
      ) {
        throw AppError.invalidUuid("id");
      }

      logger.error({ err, investorId: id }, "investor.repository.findByIdError");
      throw AppError.internal(err);
    }
  }
}
