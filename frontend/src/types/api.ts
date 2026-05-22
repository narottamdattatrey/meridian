/**
 * frontend/src/types/api.ts
 *
 * Shared API response types used by the frontend HTTP layer.
 */

import { InvestorRecord } from "@meridian/shared";


export interface ApiSuccessResponse {
  success: true;
  data: InvestorRecord;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: "VALIDATION_ERROR" | "DUPLICATE_EMAIL" | "INTERNAL_ERROR" | string;
    message: string;
    fields?: Record<string, string>;
  };
}

export type ApiResponse = ApiSuccessResponse | ApiErrorResponse;
