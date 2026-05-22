/**
 * backend/validators/investorSchema.ts
 *
 * Zod schemas for the investor API endpoints.
 *
 *  - investorCreateSchema   → validates POST /investors request body
 *  - investorIdParamSchema  → validates :id path parameter (UUIDv4)
 *
 * These are the authoritative validation rules for the backend.
 * The frontend carries its own mirror with UX-oriented wording.
 */

import { z } from "zod";
import { SUPPORTED_COUNTRIES } from "../constants/countries";

// ─────────────────────────────────────────────────────────────
//  Helper: compute the latest allowable date-of-birth for 18+
// ─────────────────────────────────────────────────────────────
const getMaxAllowedDob = (): Date => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d;
};

// ─────────────────────────────────────────────────────────────
//  POST /investors – request body
// ─────────────────────────────────────────────────────────────

export const investorCreateSchema = z.object({
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
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be in YYYY-MM-DD format.")
    .refine(
      (dob) => !isNaN(new Date(dob).getTime()),
      { message: "Date of birth is not a valid calendar date." }
    )
    .refine(
      (dob) => new Date(dob) <= getMaxAllowedDob(),
      { message: "Investor must be at least 18 years old." }
    ),

  country: z
    .string({ required_error: "Country is required." })
    .length(2, "Country must be a 2-letter ISO 3166-1 alpha-2 code.")
    .toUpperCase()
    .refine(
      (c) => SUPPORTED_COUNTRIES.includes(c),
      { message: "Country is not supported by this platform." }
    ),
});

/** TypeScript type inferred from the create schema (post-transform). */
export type InvestorCreateInput = z.infer<typeof investorCreateSchema>;

// ─────────────────────────────────────────────────────────────
//  GET /investors/:id – path parameter
// ─────────────────────────────────────────────────────────────

export const investorIdParamSchema = z.object({
  id: z
    .string({ required_error: "Path parameter 'id' is required." })
    .uuid("Path parameter 'id' must be a valid UUIDv4."),
});

export type InvestorIdParam = z.infer<typeof investorIdParamSchema>;

// ─────────────────────────────────────────────────────────────
//  Backward-compatible alias (used by existing frontend flow)
// ─────────────────────────────────────────────────────────────
export const investorOnboardingSchema = investorCreateSchema;
