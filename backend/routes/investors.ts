/**
 * backend/routes/investors.ts
 *
 * Thin HTTP adapter for the investor resource.
 */

import { Router, Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { InvestorService } from "../services/investorService";
import { AppError } from "../lib/AppError";
import { logger } from "../lib/logger";
import {
  investorCreateSchema,
  investorIdParamSchema,
} from "../validators/investorSchema";
import type {
  CreateInvestorRequestBody,
  CreateInvestorResponse,
  GetInvestorPathParams,
  GetInvestorResponse,
} from "../types/api";

// ✅ This now runs successfully without crashing, falling back to your file store!
const service = new InvestorService();

const router = Router();

// ─────────────────────────────────────────────────────────────
//  Utility
// ─────────────────────────────────────────────────────────────

function zodIssueMap(err: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".");
    if (key && !(key in fields)) {
      fields[key] = issue.message;
    }
  }
  return fields;
}

// ─────────────────────────────────────────────────────────────
//  POST /api/v1/investors
// ─────────────────────────────────────────────────────────────

router.post(
  "/",
  async (
    req: Request<Record<string, string>, CreateInvestorResponse, CreateInvestorRequestBody>,
    res: Response<CreateInvestorResponse>,
    next: NextFunction
  ): Promise<void> => {
    const parseResult = investorCreateSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json(
        AppError.validationError(zodIssueMap(parseResult.error)).toResponse()
      );
      return;
    }

    try {
      const investor = await service.createInvestor(parseResult.data);
      res.status(201).json({ success: true, data: investor });
    } catch (err: unknown) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json(err.toResponse());
        return;
      }
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────
//  GET /api/v1/investors/:id
// ─────────────────────────────────────────────────────────────

router.get(
  "/:id",
  async (
    req: Request<GetInvestorPathParams, GetInvestorResponse>,
    res: Response<GetInvestorResponse>,
    next: NextFunction
  ): Promise<void> => {
    const paramResult = investorIdParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      res.status(400).json(AppError.invalidUuid("id").toResponse());
      return;
    }

    try {
      const investor = await service.getInvestorById(paramResult.data.id);
      if (investor === null) {
        res.status(404).json(
          AppError.notFound("Investor", paramResult.data.id).toResponse()
        );
        return;
      }

      logger.debug({ investorId: paramResult.data.id }, "investor.fetched");
      res.status(200).json({ success: true, data: investor });
    } catch (err: unknown) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json(err.toResponse());
        return;
      }
      next(err);
    }
  }
);

export default router;