/**
 * packages/shared/src/index.ts
 *
 * Public API barrel for @meridian/shared.
 *
 * Import rule: consumers should always import from "@meridian/shared",
 * never from a deep path like "@meridian/shared/src/types/domain".
 * This barrel is the stable public contract; internal file structure
 * can change without touching consumers.
 */

// ── Domain types ─────────────────────────────────────────────
export type {
  InvestorRecord,
  InvestorStatus,
  CreateInvestorInput,
} from "./types/domain";

// ── Validators ───────────────────────────────────────────────
export {
  investorSchema,
  investorIdSchema,
} from "./validators/investorSchema";

export type {
  InvestorOnboardingInput,
  InvestorIdParam,
} from "./validators/investorSchema";

// ── Constants ────────────────────────────────────────────────
export {
  SUPPORTED_COUNTRIES,
  SUPPORTED_COUNTRY_CODES,
} from "./constants/countries";

export type { CountryOption } from "./constants/countries";
