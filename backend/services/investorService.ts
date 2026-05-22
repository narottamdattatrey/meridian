/**
 * backend/services/investorService.ts
 *
 * Business orchestration layer for the investor domain.
 *
 * Responsibilities:
 *  – Coordinate calls to the repository (data access)
 *  – Enforce business invariants that span multiple steps
 *  – Provide extension points for side-effects (KYC trigger,
 *    welcome email, audit log) without coupling them to the route
 *
 * What this layer deliberately does NOT do:
 *  – Know about HTTP (no Request / Response / status codes)
 *  – Know about SQL or the database driver
 *  – Know about Zod (input is already validated before it arrives here)
 *
 * Dependency injection via constructor makes the service fully
 * unit-testable: pass a MockInvestorRepository in tests, the real
 * PgInvestorRepository in production.
 */

import type { IInvestorRepository } from "../repositories/investorRepository";
import type { CreateInvestorInput, InvestorRecord } from "@meridian/shared";
import { logger } from "../lib/logger";

export class InvestorService {
  constructor(private readonly repository: IInvestorRepository) {}

  // ─────────────────────────────────────────────────────────
  //  Create
  // ─────────────────────────────────────────────────────────

  /**
   * Creates a new investor account.
   *
   * The repository handles DB-level uniqueness enforcement and maps
   * the pg `23505` error to an `AppError` with `DUPLICATE_EMAIL` —
   * the service layer surfaces that error to the route unchanged.
   *
   * Extension points:
   *  1. Insert a KYC workflow trigger after `create` succeeds.
   *  2. Dispatch a "welcome" email via a notifications service.
   *  3. Publish an `investor.created` event to a message bus.
   *
   * @throws {AppError} 409 DUPLICATE_EMAIL – propagated from repository.
   * @throws {AppError} 500 INTERNAL_ERROR  – propagated from repository.
   */
  async createInvestor(input: CreateInvestorInput): Promise<InvestorRecord> {
    const record = await this.repository.create(input);

    // ── Side-effects (non-blocking, fire-and-forget pattern) ──
    // await notificationsService.sendWelcomeEmail(record.email);
    // await kycService.initiateVerification(record.id);

    logger.info(
      { investorId: record.id, country: record.country },
      "investor.onboarded"
    );

    return record;
  }

  // ─────────────────────────────────────────────────────────
  //  Read
  // ─────────────────────────────────────────────────────────

  /**
   * Returns a single investor by UUID, or `null` if not found.
   * The route layer is responsible for translating `null` into a 404.
   *
   * @throws {AppError} 500 INTERNAL_ERROR – propagated from repository.
   */
  async getInvestorById(id: string): Promise<InvestorRecord | null> {
    return this.repository.findById(id);
  }
}
