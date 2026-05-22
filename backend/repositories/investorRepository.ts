import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
import { AppError } from "../lib/AppError";
import { logger } from "../lib/logger";
import type { InvestorRecord, CreateInvestorInput } from "@meridian/shared";


export interface IInvestorRepository {
  create(input: CreateInvestorInput): Promise<InvestorRecord>;
  findById(id: string): Promise<InvestorRecord | null>;
}

export class FileInvestorRepository implements IInvestorRepository {
  private readonly filePath: string;

  constructor(customPath?: string) {
    // Stores data in a centralized tracking file within the repository directory hierarchy
    this.filePath = customPath ?? path.join(__dirname, "../data/investors_store.json");
  }

  /**
   * Safe asynchronous helper to load current records from the file structure.
   */
  private async readStore(): Promise<InvestorRecord[]> {
    try {
      const rawData = await fs.readFile(this.filePath, "utf-8");
      return JSON.parse(rawData) as InvestorRecord[];
    } catch (err: unknown) {
      // If the storage file does not exist yet (first initialization), return an empty collection
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      logger.error({ err }, "investor.repository.fileReadError");
      throw AppError.internal(new Error("Failed to read from local file datastore."));
    }
  }

  /**
   * Safe atomic helper to commit records down to disk.
   */
  private async writeStore(data: InvestorRecord[]): Promise<void> {
    try {
      // Ensure target folder structure exists prior to payload execution
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      
      // Write with pretty formatting for debugging ease during evaluation phases
      await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), "utf-8");
    } catch (err: unknown) {
      logger.error({ err }, "investor.repository.fileWriteError");
      throw AppError.internal(new Error("Failed to write data to local file datastore."));
    }
  }

  async create(input: CreateInvestorInput): Promise<InvestorRecord> {
    console.log("Processing file storage allocation with input:", input);
    
    try {
      const records = await this.readStore();

      // 1. Simulate PostgreSQL UNIQUE_VIOLATION rule
      const normalizedEmail = input.email.toLowerCase().trim();
      const isDuplicate = records.some(inv => inv.email.toLowerCase() === normalizedEmail);
      
      if (isDuplicate) {
        throw AppError.duplicateEmail();
      }

      // 2. Simulate PostgreSQL CHECK_VIOLATION rule (Investor age limit check)
      const dob = new Date(input.date_of_birth);
      const today = new Date();
      let calculatedAge = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        calculatedAge--;
      }

      if (calculatedAge < 18) {
        logger.warn({ dob: input.date_of_birth }, "investor.repository.checkAgeViolation");
        throw new AppError(
          400,
          "CONSTRAINT_VIOLATION",
          "Database constraint violated: check_investor_minimum_age."
        );
      }

      // 3. Assemble complete row payload mirroring native database generation traits
      const currentTimeIso = new Date().toISOString();
      const newInvestorRow: InvestorRecord = {
        id: crypto.randomUUID(), // Generates standard secure UUIDv4 string format
        full_name: input.full_name,
        email: normalizedEmail,
        date_of_birth: input.date_of_birth,
        country: input.country,
        status: "pending_kyc",      // Default lifecycle state for new investors
        created_at: currentTimeIso,
        updated_at: currentTimeIso
      };

      records.push(newInvestorRow);
      await this.writeStore(records);

      return newInvestorRow;
    } catch (err: unknown) {
      if (err instanceof AppError) {
        throw err; 
      }
      logger.error({ err }, "investor.repository.createError");
      throw AppError.internal(err);
    }
  }

  async findById(id: string): Promise<InvestorRecord | null> {
    // Validate UUID layout boundaries via explicit checks to mirror native DB drivers
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      throw AppError.invalidUuid("id");
    }

    try {
      const records = await this.readStore();
      const match = records.find(inv => inv.id === id);
      
      return match ?? null;
    } catch (err: unknown) {
      logger.error({ err, investorId: id }, "investor.repository.findByIdError");
      throw AppError.internal(err);
    }
  }
}