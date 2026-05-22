import type { InvestorRecord } from "./domain";
import type { AppErrorResponse } from "../lib/AppError";


export type { InvestorRecord, AppErrorResponse };

export type OnboardInvestorErrorResponse = AppErrorResponse;

export type CreateInvestorRequestBody = Record<string, unknown>;

export interface CreateInvestorSuccessResponse {
  success: true;
  data: InvestorRecord;
}

export type CreateInvestorResponse =
  | CreateInvestorSuccessResponse
  | AppErrorResponse;

export type GetInvestorPathParams = Record<string, string>;

export interface GetInvestorSuccessResponse {
  success: true;
  data: InvestorRecord;
}

export type GetInvestorResponse =
  | GetInvestorSuccessResponse
  | AppErrorResponse;

export interface VerifyOtpSuccessResponse {
  success: true;
  data: { verified: true; investorId: string };
}

export type VerifyOtpResponse = VerifyOtpSuccessResponse | AppErrorResponse;
