/**
 * frontend/src/api/investorApi.ts
 *
 * Thin, typed fetch wrapper for the investor onboarding endpoint.
 */

import type { InvestorFormValues } from "../validators/investorSchema";
import type { ApiResponse } from "../types/api";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly body: ApiResponse
  ) {
    super(`HTTP ${statusCode}`);
    this.name = "HttpError";
  }
}

export async function submitInvestorOnboarding(
  payload: InvestorFormValues
): Promise<ApiResponse> {
  const url = `${API_BASE}/api/v1/investors`;

  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (networkError: unknown) {
    // Network-level failure (offline, DNS, CORS preflight block, etc.)
    const message =
      networkError instanceof Error
        ? networkError.message
        : "Unknown network error";

    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: `Unable to reach the server. Please check your connection. (${message})`,
      },
    };
  }

  // Parse JSON body regardless of status so we can surface structured errors
  let body: ApiResponse;

  try {
    body = (await response.json()) as ApiResponse;
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
