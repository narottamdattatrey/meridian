/**
 * frontend/src/validators/investorSchema.ts
 *
 * Thin shim — re-exports the canonical schema from @meridian/shared
 * under the frontend-idiomatic names the components expect.
 */
export { investorSchema as investorFormSchema } from "@meridian/shared";
export type { InvestorOnboardingInput as InvestorFormValues } from "@meridian/shared";
