/**
 * frontend/src/types/api.ts
 *
 * Shared API response types used by the frontend HTTP layer.
 */

export type InvestorStatus = "pending_kyc" | "active" | "suspended" | "closed";

export interface InvestorRecord {
  id: string;
  full_name: string;
  email: string;
  date_of_birth: string;
  country: string;
  status: InvestorStatus;
  created_at: string;
  updated_at: string;
}

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
