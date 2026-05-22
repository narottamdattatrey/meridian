/**
 * frontend/src/api/otpApi.ts
 *
 * Typed fetch wrapper for the OTP verification endpoint.
 */

import type { VerifyOtpInput } from "@meridian/shared";
import type { ApiErrorResponse } from "../types/api";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export interface OtpSuccessResponse {
  success: true;
  data: { verified: true; investorId: string };
}

export type OtpApiResponse = OtpSuccessResponse | ApiErrorResponse;

export async function verifyOtp(payload: VerifyOtpInput): Promise<OtpApiResponse> {
  const url = `${API_BASE}/api/auth/verify-otp`;

  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (networkError: unknown) {
    const message =
      networkError instanceof Error
        ? networkError.message
        : "Unknown network error";
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: `Could not reach the server: ${message}`,
      },
    };
  }

  let body: OtpApiResponse;
  try {
    body = (await response.json()) as OtpApiResponse;
  } catch {
    return {
      success: false,
      error: {
        code: "PARSE_ERROR",
        message: "The server returned an unreadable response. Please try again.",
      },
    };
  }

  return body;
}
