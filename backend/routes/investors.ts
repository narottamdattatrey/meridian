/**
 * backend/routes/investors.ts
 *
 * Thin HTTP adapter for the investor resource.
 *
 *   POST /api/v1/investors        → 201 Created
 *   GET  /api/v1/investors/:id    → 200 OK | 404 Not Found
 *
 * Responsibilities of this layer (and ONLY this layer):
 *  1. Parse & validate the raw HTTP request (Zod).
 *  2. Call the appropriate InvestorService method.
 *  3. Map the result (or AppError) to an HTTP status + JSON body.
 *
 * What this layer must NOT do:
 *  – Talk to the database directly
 *  – Contain any business logic
 *  – Call res.status(500) — unknown errors are forwarded to next()
 */

import { Router, Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { InvestorService } from "../services/investorService";
import { PgInvestorRepository } from "../repositories/investorRepository";
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

// ── Composition root ─────────────────────────────────────────
// Instantiated once at module load; swap PgInvestorRepository for a
// MockInvestorRepository in integration tests by re-requiring this
// module with dependency injection or by using a test-scoped factory.
const service = new InvestorService(new PgInvestorRepository());

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
    // 1. Validate
    const parseResult = investorCreateSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json(
        AppError.validationError(zodIssueMap(parseResult.error)).toResponse()
      );
      return;
    }

    // 2. Orchestrate
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
    // 1. Validate path param
    const paramResult = investorIdParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      res.status(400).json(AppError.invalidUuid("id").toResponse());
      return;
    }

    // 2. Orchestrate
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
