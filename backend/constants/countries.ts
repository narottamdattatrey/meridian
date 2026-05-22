/**
 * backend/constants/countries.ts
 *
 * Supported ISO 3166-1 alpha-2 country codes for the platform.
 * Extend this list as the platform expands into new jurisdictions.
 */

export const SUPPORTED_COUNTRIES: string[] = [
  "AE", // United Arab Emirates
  "AT", // Austria
  "AU", // Australia
  "BE", // Belgium
  "BR", // Brazil
  "CA", // Canada
  "CH", // Switzerland
  "DE", // Germany
  "DK", // Denmark
  "ES", // Spain
  "FI", // Finland
  "FR", // France
  "GB", // United Kingdom
  "HK", // Hong Kong
  "IE", // Ireland
  "IN", // India
  "IT", // Italy
  "JP", // Japan
  "KR", // South Korea
  "LU", // Luxembourg
  "MX", // Mexico
  "NL", // Netherlands
  "NG", // Nigeria
  "NO", // Norway
  "NZ", // New Zealand
  "PL", // Poland
  "PT", // Portugal
  "SE", // Sweden
  "SG", // Singapore
  "US", // United States
  "ZA", // South Africa
];

export type SupportedCountryCode = (typeof SUPPORTED_COUNTRIES)[number];
