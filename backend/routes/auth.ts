/**
 * backend/routes/auth.ts
 *
 * Auth-related endpoints.
 *
 * POST /api/auth/verify-otp
 *   Accepts a 6-digit OTP code and the investor ID returned from step 1.
 *   In this mock implementation the only valid code is "123456".
 *   On success returns { success: true, data: { verified: true, investorId } }.
 *   On invalid code returns a 400 AppError with code INVALID_OTP.
 */

import { Router, Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../lib/AppError";
import { logger } from "../lib/logger";
import { verifyOtpSchema, type VerifyOtpInput } from "../validators/otpSchema";

const router = Router();

/** The dummy verification code accepted by this mock endpoint. */
const DUMMY_OTP_CODE = "123456";

router.post(
  "/verify-otp",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const parseResult = verifyOtpSchema.safeParse(req.body);

    if (!parseResult.success) {
      const zodError = parseResult.error as ZodError;
      const fields: Record<string, string> = {};
      for (const issue of zodError.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !(key in fields)) {
          fields[key] = issue.message;
        }
      }
      res
        .status(400)
        .json(AppError.validationError(fields, zodError).toResponse());
      return;
    }

    const { investorId, code }: VerifyOtpInput = parseResult.data;

    logger.info({ investorId }, "OTP verification attempt");

    if (code !== DUMMY_OTP_CODE) {
      res.status(400).json(AppError.invalidOtp().toResponse());
      return;
    }

    logger.info({ investorId }, "OTP verification succeeded");

    res.status(200).json({
      success: true,
      data: { verified: true, investorId },
    });
  }
);

export default router;
