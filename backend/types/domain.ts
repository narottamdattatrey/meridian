/**
 * backend/types/domain.ts
 *
 * Re-exports from @meridian/shared.
 * All domain types are defined in the shared package; this shim preserves
 * any existing backend imports without requiring them to change.
 */
export type {
  InvestorRecord,
  InvestorStatus,
  CreateInvestorInput,
} from "@meridian/shared";
