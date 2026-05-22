/**
 * db/mockStore.ts
 *
 * In-memory mock store that mirrors the `investors` PostgreSQL table.
 * Retained for local development and testing environments that run
 * without a live database connection.
 *
 * Domain types are imported from types/domain.ts — the single source
 * of truth for the InvestorRecord shape.
 */

import { randomUUID } from "crypto";
import type { InvestorRecord, InvestorStatus } from "../types/domain";

// Re-export so existing consumers that import from mockStore still compile.
export type { InvestorRecord, InvestorStatus };

// ─────────────────────────────────────────────────────────────
//  Seed / mock data (localized across multiple countries)
// ─────────────────────────────────────────────────────────────

const now = new Date().toISOString();

export const investorStore: InvestorRecord[] = [
  {
    id: randomUUID(),
    full_name: "Amelia Thornton",
    email: "amelia.thornton@example.co.uk",
    date_of_birth: "1985-03-22",
    country: "GB",
    status: "active",
    created_at: now,
    updated_at: now,
  },
  {
    id: randomUUID(),
    full_name: "Hiroshi Tanaka",
    email: "hiroshi.tanaka@example.jp",
    date_of_birth: "1979-11-04",
    country: "JP",
    status: "active",
    created_at: now,
    updated_at: now,
  },
  {
    id: randomUUID(),
    full_name: "Fatima Al-Rashid",
    email: "fatima.alrashid@example.ae",
    date_of_birth: "1990-07-18",
    country: "AE",
    status: "pending_kyc",
    created_at: now,
    updated_at: now,
  },
  {
    id: randomUUID(),
    full_name: "Carlos Mendoza",
    email: "carlos.mendoza@example.mx",
    date_of_birth: "1982-01-30",
    country: "MX",
    status: "active",
    created_at: now,
    updated_at: now,
  },
  {
    id: randomUUID(),
    full_name: "Priya Nair",
    email: "priya.nair@example.in",
    date_of_birth: "1993-09-12",
    country: "IN",
    status: "pending_kyc",
    created_at: now,
    updated_at: now,
  },
  {
    id: randomUUID(),
    full_name: "Lars Eriksson",
    email: "lars.eriksson@example.se",
    date_of_birth: "1975-06-05",
    country: "SE",
    status: "active",
    created_at: now,
    updated_at: now,
  },
  {
    id: randomUUID(),
    full_name: "Yewande Adeyemi",
    email: "yewande.adeyemi@example.ng",
    date_of_birth: "1988-12-27",
    country: "NG",
    status: "active",
    created_at: now,
    updated_at: now,
  },
];

// ─────────────────────────────────────────────────────────────
//  Store accessors (simulate async DB calls)
// ─────────────────────────────────────────────────────────────

/** Simulate network + DB latency. */
const simulateLatency = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 60));

export const findInvestorByEmail = async (
  email: string
): Promise<InvestorRecord | undefined> => {
  await simulateLatency();
  return investorStore.find(
    (r) => r.email.toLowerCase() === email.toLowerCase()
  );
};

export const insertInvestor = async (
  payload: Omit<InvestorRecord, "id" | "status" | "created_at" | "updated_at">
): Promise<InvestorRecord> => {
  await simulateLatency();

  const ts = new Date().toISOString();
  const record: InvestorRecord = {
    id: randomUUID(),
    ...payload,
    status: "pending_kyc",
    created_at: ts,
    updated_at: ts,
  };

  investorStore.push(record);
  return record;
};
