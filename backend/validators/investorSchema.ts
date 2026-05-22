/**
 * backend/validators/investorSchema.ts
 *
 * Re-exports from @meridian/shared with backend-idiomatic aliases.
 *
 * – investorCreateSchema   alias for the shared investorSchema
 * – investorIdParamSchema  alias for the shared investorIdSchema
 * – InvestorCreateInput    alias for InvestorOnboardingInput
 * – investorOnboardingSchema  backward-compat alias
 */
export {
  investorSchema as investorCreateSchema,
  investorSchema as investorOnboardingSchema,
  investorIdSchema as investorIdParamSchema,
} from "@meridian/shared";

export type {
  InvestorOnboardingInput as InvestorCreateInput,
  InvestorIdParam,
} from "@meridian/shared";
