/**
 * packages/shared/src/validators/otpSchema.ts
 *
 * Zod schema for the OTP email-verification step.
 * Consumed by the backend route handler (body validation) and by the
 * frontend OTP component (client-side guard before the API call).
 */

import { z } from "zod";

/** Validates a single 6-digit numeric code string. */
export const otpCodeSchema = z
  .string({ required_error: "Verification code is required." })
  .length(6, "Verification code must be exactly 6 digits.")
  .regex(/^\d{6}$/, "Verification code must contain only digits.");

/** Full body schema for POST /api/auth/verify-otp. */
export const verifyOtpSchema = z.object({
  investorId: z
    .string({ required_error: "Investor ID is required." })
    .uuid("Investor ID must be a valid UUID."),
  code: otpCodeSchema,
});

export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
