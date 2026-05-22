/**
 * backend/routes/investors.ts
 *
 * Express router for the investor resource.
 *
 *   POST /api/v1/investors          → create a new investor (201)
 *   GET  /api/v1/investors/:id      → fetch an investor by UUID (200 / 404)
 *
 * Error handling contract
 * ───────────────────────
 * Route handlers NEVER call res.status(500) directly. All unexpected
 * errors are forwarded to Express's global error handler via next(err).
 * Only well-typed AppError instances are handled inline; everything else
 * is delegated so the error boundary in app.ts remains the single place
 * that converts unknown failures into sanitised 500 responses.
 */

import { Router, Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../lib/AppError";
import { logger } from "../lib/logger";
import {
  investorCreateSchema,
  investorIdParamSchema,
} from "../validators/investorSchema";
import {
  createInvestor,
  findInvestorById,
} from "../repositories/investorRepository";
import type {
  CreateInvestorRequestBody,
  CreateInvestorResponse,
  GetInvestorPathParams,
  GetInvestorResponse,
} from "../types/api";

const router = Router();

// ─────────────────────────────────────────────────────────────
//  Utility: flatten ZodError issues into { field: firstMessage }
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
//
//  201 – Investor created; returns the full persisted record.
//  400 – Payload failed Zod validation (with per-field feedback).
//  409 – Duplicate email address.
//  500 – Unexpected internal error (forwarded to global handler).
// ─────────────────────────────────────────────────────────────

router.post(
  "/",
  async (
    req: Request<Record<string, string>, CreateInvestorResponse, CreateInvestorRequestBody>,
    res: Response<CreateInvestorResponse>,
    next: NextFunction
  ): Promise<void> => {
    // ── 1. Validate & parse the request body ──────────────────
    const parseResult = investorCreateSchema.safeParse(req.body);

    if (!parseResult.success) {
      const fields = zodIssueMap(parseResult.error);
      res.status(400).json(
        AppError.validationError(fields).toResponse()
      );
      return;
    }

    const input = parseResult.data;

    try {
      // ── 2. Persist via repository (throws typed AppErrors) ───
      const investor = await createInvestor(input);

      res.status(201).json({ success: true, data: investor });
    } catch (err: unknown) {
      if (err instanceof AppError) {
        // 409 Conflict (duplicate email) handled inline.
        // Any other AppError status is also handled here cleanly.
        res.status(err.statusCode).json(err.toResponse());
        return;
      }
      // Delegate unexpected errors to the global error handler.
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────
//  GET /api/v1/investors/:id
//
//  200 – Investor found; returns the full record.
//  400 – :id is not a valid UUIDv4.
//  404 – No investor exists for the given id.
//  500 – Unexpected internal error (forwarded to global handler).
// ─────────────────────────────────────────────────────────────

router.get(
  "/:id",
  async (
    req: Request<GetInvestorPathParams, GetInvestorResponse>,
    res: Response<GetInvestorResponse>,
    next: NextFunction
  ): Promise<void> => {
    // ── 1. Validate the :id path parameter ────────────────────
    const paramResult = investorIdParamSchema.safeParse(req.params);

    if (!paramResult.success) {
      res.status(400).json(
        AppError.invalidUuid("id").toResponse()
      );
      return;
    }

    const { id } = paramResult.data;

    try {
      // ── 2. Fetch from repository ───────────────────────────
      const investor = await findInvestorById(id);

      if (investor === null) {
        res.status(404).json(
          AppError.notFound("Investor", id).toResponse()
        );
        return;
      }

      logger.debug({ investorId: id }, "investor.fetched");
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
