/**
 * backend/types/domain.ts
 *
 * Core domain types that mirror the `investors` PostgreSQL table.
 * Shared by the repository layer, API types, and the mock store.
 * Deliberately free of any HTTP or framework concerns.
 */

export type InvestorStatus = "pending_kyc" | "active" | "suspended" | "closed";

/**
 * Exact shape returned from the database for a single investor row.
 * Field names match the snake_case column names so pg's QueryResult
 * can be used without a mapping step.
 */
export interface InvestorRecord {
  /** UUIDv4 primary key. */
  id: string;
  /** Investor's full legal name (max 200 chars). */
  full_name: string;
  /** Normalised lowercase email (max 254 chars). */
  email: string;
  /** ISO-8601 date string YYYY-MM-DD. */
  date_of_birth: string;
  /** ISO 3166-1 alpha-2 country code (uppercase). */
  country: string;
  /** Current KYC/account lifecycle state. */
  status: InvestorStatus;
  /** UTC ISO-8601 timestamp of record creation. */
  created_at: string;
  /** UTC ISO-8601 timestamp of last modification. */
  updated_at: string;
}

/**
 * Minimal input required to create a new investor.
 * The repository generates id, status, and timestamps.
 */
export type CreateInvestorInput = Pick<
  InvestorRecord,
  "full_name" | "email" | "date_of_birth" | "country"
>;
