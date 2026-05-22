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
  { code: "AT", label: "Austria" },
  { code: "AU", label: "Australia" },
  { code: "BE", label: "Belgium" },
  { code: "BR", label: "Brazil" },
  { code: "CA", label: "Canada" },
  { code: "CH", label: "Switzerland" },
  { code: "DE", label: "Germany" },
  { code: "DK", label: "Denmark" },
  { code: "ES", label: "Spain" },
  { code: "FI", label: "Finland" },
  { code: "FR", label: "France" },
  { code: "GB", label: "United Kingdom" },
  { code: "HK", label: "Hong Kong" },
  { code: "IE", label: "Ireland" },
  { code: "IN", label: "India" },
  { code: "IT", label: "Italy" },
  { code: "JP", label: "Japan" },
  { code: "KR", label: "South Korea" },
  { code: "LU", label: "Luxembourg" },
  { code: "MX", label: "Mexico" },
  { code: "NL", label: "Netherlands" },
  { code: "NG", label: "Nigeria" },
  { code: "NO", label: "Norway" },
  { code: "NZ", label: "New Zealand" },
  { code: "PL", label: "Poland" },
  { code: "PT", label: "Portugal" },
  { code: "SE", label: "Sweden" },
  { code: "SG", label: "Singapore" },
  { code: "US", label: "United States" },
  { code: "ZA", label: "South Africa" },
] as const;

/**
 * Derived lookup set for O(1) membership checks inside Zod validators.
 * Typed as `string[]` so both backend and frontend `refine` callbacks
 * accept it without type errors.
 */
export const SUPPORTED_COUNTRY_CODES: string[] = SUPPORTED_COUNTRIES.map(
  (c) => c.code
);
