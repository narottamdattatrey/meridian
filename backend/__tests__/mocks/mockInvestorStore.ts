/**
 * backend/__tests__/mocks/mockInvestorStore.ts
 *
 * In-memory test double for `IInvestorRepository`.
 *
 * Use `MockInvestorRepository` in unit tests to isolate the
 * `InvestorService` from any database or network dependency.
 *
 * Design:
 *  – `SEED_INVESTORS` is a pure-value const used to reset state.
 *  – `MockInvestorRepository` implements `IInvestorRepository` faithfully:
 *      · Throws `AppError` 409 on duplicate emails (mirrors PG 23505).
 *      · Generates UUIDs and timestamps like the real DB would.
 *  – `reset()` is a test-utility method that restores the in-memory
 *    store to seed state between test cases (call it in `beforeEach`).
 *
 * Usage:
 *
 *   const repo = new MockInvestorRepository();
 *   const service = new InvestorService(repo);
 *
 *   beforeEach(() => repo.reset());
 *
 *   it('returns 409 on duplicate email', async () => {
 *     await expect(
 *       service.createInvestor({ ...seedInput, email: SEED_INVESTORS[0].email })
 *     ).rejects.toMatchObject({ code: 'DUPLICATE_EMAIL' });
 *   });
 */

import { randomUUID } from "crypto";
import type { IInvestorRepository } from "../../repositories/investorRepository";
import type { CreateInvestorInput, InvestorRecord } from "@meridian/shared";
import { AppError } from "../../lib/AppError";

// ─────────────────────────────────────────────────────────────
//  Seed data
//  Localised sample records. Stable — no randomised IDs at module
//  load time so snapshot tests remain deterministic.
// ─────────────────────────────────────────────────────────────

export const SEED_INVESTORS: InvestorRecord[] = [
  {
    id: "11111111-1111-4111-a111-111111111111",
    full_name: "Amelia Thornton",
    email: "amelia.thornton@example.co.uk",
    date_of_birth: "1985-03-22",
    country: "GB",
    status: "active",
    created_at: "2026-01-10T09:00:00.000Z",
    updated_at: "2026-01-10T09:00:00.000Z",
  },
  {
    id: "22222222-2222-4222-a222-222222222222",
    full_name: "Hiroshi Tanaka",
    email: "hiroshi.tanaka@example.jp",
    date_of_birth: "1979-11-04",
    country: "JP",
    status: "active",
    created_at: "2026-01-11T10:00:00.000Z",
    updated_at: "2026-01-11T10:00:00.000Z",
  },
  {
    id: "33333333-3333-4333-a333-333333333333",
    full_name: "Fatima Al-Rashid",
    email: "fatima.alrashid@example.ae",
    date_of_birth: "1990-07-18",
    country: "AE",
    status: "pending_kyc",
    created_at: "2026-02-01T08:30:00.000Z",
    updated_at: "2026-02-01T08:30:00.000Z",
  },
  {
    id: "44444444-4444-4444-a444-444444444444",
    full_name: "Carlos Mendoza",
    email: "carlos.mendoza@example.mx",
    date_of_birth: "1982-01-30",
    country: "MX",
    status: "active",
    created_at: "2026-02-14T14:00:00.000Z",
    updated_at: "2026-02-14T14:00:00.000Z",
  },
  {
    id: "55555555-5555-4555-a555-555555555555",
    full_name: "Priya Nair",
    email: "priya.nair@example.in",
    date_of_birth: "1993-09-12",
    country: "IN",
    status: "pending_kyc",
    created_at: "2026-03-05T11:15:00.000Z",
    updated_at: "2026-03-05T11:15:00.000Z",
  },
];

// ─────────────────────────────────────────────────────────────
//  Test double
// ─────────────────────────────────────────────────────────────

export class MockInvestorRepository implements IInvestorRepository {
  private store: InvestorRecord[];

  constructor(initialData: InvestorRecord[] = [...SEED_INVESTORS]) {
    // Defensive copy so tests don't share mutable state.
    this.store = initialData.map((r) => ({ ...r }));
  }

  // ── IInvestorRepository ──────────────────────────────────

  async create(input: CreateInvestorInput): Promise<InvestorRecord> {
    // Mirror the production UNIQUE constraint on LOWER(email).
    const exists = this.store.some(
      (r) => r.email.toLowerCase() === input.email.toLowerCase()
    );
    if (exists) {
      throw AppError.duplicateEmail();
    }

    const ts = new Date().toISOString();
    const record: InvestorRecord = {
      id: randomUUID(),
      full_name: input.full_name,
      email: input.email.toLowerCase(),
      date_of_birth: input.date_of_birth,
      country: input.country,
      status: "pending_kyc",
      created_at: ts,
      updated_at: ts,
    };

    this.store.push(record);
    return { ...record }; // return a copy so callers can't mutate the store
  }

  async findById(id: string): Promise<InvestorRecord | null> {
    const record = this.store.find((r) => r.id === id);
    return record !== undefined ? { ...record } : null;
  }

  // ── Test utilities ───────────────────────────────────────

  /**
   * Resets the store to a fresh copy of `SEED_INVESTORS`.
   * Call this in `beforeEach` to guarantee test isolation.
   */
  reset(data: InvestorRecord[] = SEED_INVESTORS): void {
    this.store = data.map((r) => ({ ...r }));
  }

  /**
   * Returns a snapshot of the current store contents.
   * Useful for assertions after mutations.
   */
  snapshot(): InvestorRecord[] {
    return this.store.map((r) => ({ ...r }));
  }

  /** Returns the current number of records in the store. */
  get size(): number {
    return this.store.length;
  }
}
