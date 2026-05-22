/**
 * backend/services/investorService.ts
 *
 * Business orchestration layer for the investor domain.
 */

import { FileInvestorRepository } from "../repositories/investorRepository"; // ✅ Add this import
import type { IInvestorRepository } from "../repositories/investorRepository";
import type { CreateInvestorInput, InvestorRecord } from "@meridian/shared";
import { logger } from "../lib/logger";

export class InvestorService {
  // ✅ Fallback to FileInvestorRepository automatically if none is provided
  constructor(
    private readonly repository: IInvestorRepository = new FileInvestorRepository()
  ) {}

  /**
   * Creates a new investor account.
   */
  async createInvestor(input: CreateInvestorInput): Promise<InvestorRecord> {
    const record = await this.repository.create(input);

    logger.info(
      { investorId: record.id, country: record.country },
      "investor.onboarded"
    );

    return record;
  }

  /**
   * Returns a single investor by UUID, or `null` if not found.
   */
  async getInvestorById(id: string): Promise<InvestorRecord | null> {
    return this.repository.findById(id);
  }
}