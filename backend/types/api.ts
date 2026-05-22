/**
 * backend/types/api.ts
 *
 * Strict TypeScript interfaces for every HTTP request/response shape
 * in the investor API surface.
 *
 * These types carry no framework imports – they describe the JSON
 * contract, not Express internals.
 */

import type { InvestorRecord } from "./domain";
import type { AppErrorResponse } from "../lib/AppError";

// ─────────────────────────────────────────────────────────────
//  Re-export so callers can import everything from one place
// ─────────────────────────────────────────────────────────────

export type { InvestorRecord, AppErrorResponse };

// Keep backward-compatible alias used by app.ts global error handler.
export type OnboardInvestorErrorResponse = AppErrorResponse;

// ─────────────────────────────────────────────────────────────
//  POST /api/v1/investors
// ─────────────────────────────────────────────────────────────

/**
 * Raw incoming request body before Zod validation.
 * Typed as a plain object of unknowns – the Zod schema is the single
 * source of truth for the validated shape.
 */
export type CreateInvestorRequestBody = Record<string, unknown>;

export interface CreateInvestorSuccessResponse {
  success: true;
  data: InvestorRecord;
}

export type CreateInvestorResponse =
  | CreateInvestorSuccessResponse
  | AppErrorResponse;

// ─────────────────────────────────────────────────────────────
//  GET /api/v1/investors/:id
// ─────────────────────────────────────────────────────────────

/** Raw Express path parameters (string map) before UUID validation. */
export type GetInvestorPathParams = Record<string, string>;

export interface GetInvestorSuccessResponse {
  success: true;
  data: InvestorRecord;
}

export type GetInvestorResponse =
  | GetInvestorSuccessResponse
  | AppErrorResponse;
