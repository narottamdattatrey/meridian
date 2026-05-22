/**
 * backend/validators/otpSchema.ts
 *
 * Shim — re-exports OTP schema from @meridian/shared.
 * All consumers in `backend/` should import from this path.
 */

export { verifyOtpSchema, otpCodeSchema } from "@meridian/shared";
export type { VerifyOtpInput } from "@meridian/shared";
