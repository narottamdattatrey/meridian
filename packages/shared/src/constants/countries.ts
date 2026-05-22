/**
 * packages/shared/src/constants/countries.ts
 *
 * Canonical country reference data for the Meridian platform.
 *
 * Exports:
 *  – `SUPPORTED_COUNTRIES`      labelled options for UI select components
 *  – `SUPPORTED_COUNTRY_CODES`  readonly string tuple used by Zod validators
 */

export interface CountryOption {
  /** ISO 3166-1 alpha-2 code (uppercase). */
  code: string;
  /** Human-readable display name. */
  label: string;
}

export const SUPPORTED_COUNTRIES: CountryOption[] = [
  { code: "AE", label: "United Arab Emirates" },
  { code: "IN", label: "India" },
  { code: "US", label: "United States" },
] as const;

/**
 * Derived lookup set for O(1) membership checks inside Zod validators.
 * Typed as `string[]` so both backend and frontend `refine` callbacks
 * accept it without type errors.
 */
export const SUPPORTED_COUNTRY_CODES: string[] = SUPPORTED_COUNTRIES.map(
  (c) => c.code
);
