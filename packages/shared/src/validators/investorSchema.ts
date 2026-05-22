/**
 * packages/shared/src/validators/investorSchema.ts
 *
 * Canonical Zod validation schemas for the investor onboarding flow.
 *
 * This is the SINGLE source of truth for validation rules across the
 * entire platform. Both the Express backend and the React frontend
 * import from this file (via @meridian/shared) — eliminating the
 * mirrored-but-diverging schemas that existed before the monorepo.
 *
 * Exports:
 *  – investorSchema        validated shape for POST /investors
 *  – investorIdSchema      validated shape for GET /investors/:id (backend)
 *  – InvestorOnboardingInput  inferred type from investorSchema
 *  – InvestorIdParam          inferred type from investorIdSchema
 */

import { z } from "zod";
import { SUPPORTED_COUNTRY_CODES } from "../constants/countries";

// ─────────────────────────────────────────────────────────────
//  Internal helper
// ─────────────────────────────────────────────────────────────

/**
 * Returns the latest date-of-birth that satisfies the 18+ requirement,
 * computed fresh on each call so tests can control `Date.now`.
 */
const maxAllowedDob = (): Date => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d;
};

// ─────────────────────────────────────────────────────────────
//  Core investor onboarding schema
//  Used by: POST /investors (backend) + onboarding form (frontend)
// ─────────────────────────────────────────────────────────────

export const investorSchema = z.object({
  full_name: z
    .string({ required_error: "Full name is required." })
    .trim()
    .min(2, "Full name must be at least 2 characters.")
    .max(200, "Full name must not exceed 200 characters.")
    .regex(
      /^[\p{L}\p{M}' .-]+$/u,
      "Full name contains invalid characters."
    ),

  email: z
    .string({ required_error: "Email is required." })
    .trim()
    .toLowerCase()
    .email("A valid email address is required.")
    .max(254, "Email must not exceed 254 characters."),

  date_of_birth: z
    .string({ required_error: "Date of birth is required." })
    .min(1, "Date of birth is required.")
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      "Date of birth must be in YYYY-MM-DD format."
    )
    .refine(
      (dob) => !isNaN(new Date(dob).getTime()),
      { message: "Date of birth is not a valid calendar date." }
    )
    .refine(
      (dob) => new Date(dob) <= maxAllowedDob(),
      { message: "Investor must be at least 18 years old." }
    ),

  country: z
    .string({ required_error: "Country is required." })
    .min(1, "Country is required.")
    .length(2, "Country must be a 2-letter ISO 3166-1 alpha-2 code.")
    .toUpperCase()
    .refine(
      (c) => SUPPORTED_COUNTRY_CODES.includes(c),
      { message: "Country is not supported by this platform." }
    ),
});

/** Fully validated, post-transform investor input. */
export type InvestorOnboardingInput = z.infer<typeof investorSchema>;

// ─────────────────────────────────────────────────────────────
//  UUID path-parameter schema
//  Used by: GET /investors/:id (backend route layer)
//  Included here so the backend can import everything from one place.
// ─────────────────────────────────────────────────────────────

export const investorIdSchema = z.object({
  id: z
    .string({ required_error: "Path parameter 'id' is required." })
    .uuid("Path parameter 'id' must be a valid UUIDv4."),
});

export type InvestorIdParam = z.infer<typeof investorIdSchema>;
