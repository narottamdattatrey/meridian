/**
 * backend/__tests__/unit/investorService.test.ts
 *
 * Isolated unit tests for InvestorService.
 *
 * Strategy
 * ────────
 * We inject the existing MockInvestorRepository (from __tests__/mocks/)
 * into the InvestorService constructor, giving us full control over every
 * outcome the repository produces.  No disk I/O, no network, no database.
 *
 * Covers:
 *  createInvestor
 *    ✓ Returns a fully populated InvestorRecord on success
 *    ✓ Normalises email to lowercase before storing
 *    ✓ Auto-assigns status "pending_kyc" regardless of input
 *    ✓ Auto-generates a UUIDv4 id
 *    ✓ Sets created_at and updated_at to valid ISO-8601 strings
 *    ✓ Re-throws AppError (409 DUPLICATE_EMAIL) from the repository unchanged
 *    ✓ Re-throws any AppError from the repository without mutation
 *
 *  getInvestorById
 *    ✓ Returns null for a non-existent id
 *    ✓ Returns the correct InvestorRecord when the id is found
 *    ✓ Returns a copy — mutating the result does not corrupt the store
 */

import { InvestorService } from "../../services/investorService";
import { AppError } from "../../lib/AppError";
import { MockInvestorRepository } from "../mocks/mockInvestorStore";
import type { IInvestorRepository } from "../../repositories/investorRepository";
import type { CreateInvestorInput } from "@meridian/shared";

// ─────────────────────────────────────────────────────────────────────────────
//  Shared fixtures
// ─────────────────────────────────────────────────────────────────────────────

/** A valid 18+ date of birth, stable regardless of when the tests run. */
const validDob = (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 25);
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
})();

const VALID_INPUT: CreateInvestorInput = {
  full_name: "Alice Smith",
  email: "alice.smith@example.com",
  date_of_birth: validDob,
  country: "US",
};

// RFC 4122 UUIDv4 pattern
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ISO-8601 UTC datetime pattern
const ISO_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

// ─────────────────────────────────────────────────────────────────────────────
//  Test suite
// ─────────────────────────────────────────────────────────────────────────────

describe("InvestorService", () => {
  let repo: MockInvestorRepository;
  let service: InvestorService;

  beforeEach(() => {
    // Start with an empty store for each test — no seed data interference.
    repo = new MockInvestorRepository([]);
    service = new InvestorService(repo);
  });

  // ───────────────────────────────────────────────────────────────────────────
  //  createInvestor
  // ───────────────────────────────────────────────────────────────────────────

  describe("createInvestor", () => {
    it("returns a fully populated InvestorRecord matching the input", async () => {
      const result = await service.createInvestor(VALID_INPUT);

      expect(result.full_name).toBe(VALID_INPUT.full_name);
      expect(result.date_of_birth).toBe(VALID_INPUT.date_of_birth);
      expect(result.country).toBe(VALID_INPUT.country);
    });

    it("auto-generates a UUIDv4 id", async () => {
      const result = await service.createInvestor(VALID_INPUT);
      expect(result.id).toMatch(UUID_PATTERN);
    });

    it("normalises email to lowercase", async () => {
      const result = await service.createInvestor({
        ...VALID_INPUT,
        email: "ALICE.SMITH@EXAMPLE.COM",
      });
      expect(result.email).toBe("alice.smith@example.com");
    });

    it("always assigns status 'pending_kyc' for new investors", async () => {
      const result = await service.createInvestor(VALID_INPUT);
      expect(result.status).toBe("pending_kyc");
    });

    it("sets created_at and updated_at to valid ISO-8601 UTC timestamps", async () => {
      const result = await service.createInvestor(VALID_INPUT);
      expect(result.created_at).toMatch(ISO_DATETIME_PATTERN);
      expect(result.updated_at).toMatch(ISO_DATETIME_PATTERN);
    });

    it("persists the record so subsequent creates can detect duplicates", async () => {
      await service.createInvestor(VALID_INPUT);
      expect(repo.size).toBe(1);
    });

    it("re-throws AppError 409 DUPLICATE_EMAIL unchanged when the repository detects a clash", async () => {
      await service.createInvestor(VALID_INPUT);

      // Second call with same email — MockInvestorRepository throws the same
      // AppError that PgInvestorRepository would throw on a 23505 violation.
      const duplicate = service.createInvestor(VALID_INPUT);

      await expect(duplicate).rejects.toBeInstanceOf(AppError);
      await expect(
        service.createInvestor(VALID_INPUT)
      ).rejects.toMatchObject<Partial<AppError>>({
        code: "DUPLICATE_EMAIL",
        statusCode: 409,
      });
    });

    it("email duplicate detection is case-insensitive", async () => {
      await service.createInvestor(VALID_INPUT);

      await expect(
        service.createInvestor({ ...VALID_INPUT, email: "ALICE.SMITH@EXAMPLE.COM" })
      ).rejects.toMatchObject<Partial<AppError>>({ code: "DUPLICATE_EMAIL" });
    });

    it("re-throws any AppError from the repository without mutation", async () => {
      // Use a minimal ad-hoc stub that always throws a specific AppError.
      const internalErr = AppError.internal(new Error("disk full"));

      const brokenRepo = {
        create: jest.fn().mockRejectedValue(internalErr),
        findById: jest.fn().mockResolvedValue(null),
      } as IInvestorRepository;

      const svc = new InvestorService(brokenRepo);
      // Must be the exact same object reference — the service must not wrap it.
      await expect(svc.createInvestor(VALID_INPUT)).rejects.toBe(internalErr);
    });

    it("generates unique ids for multiple sequential creates", async () => {
      const a = await service.createInvestor(VALID_INPUT);
      const b = await service.createInvestor({ ...VALID_INPUT, email: "bob@example.com" });
      expect(a.id).not.toBe(b.id);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  //  getInvestorById
  // ───────────────────────────────────────────────────────────────────────────

  describe("getInvestorById", () => {
    it("returns null for an id that does not exist in the store", async () => {
      const result = await service.getInvestorById(
        "00000000-0000-4000-8000-000000000000"
      );
      expect(result).toBeNull();
    });

    it("returns the matching InvestorRecord when the id exists", async () => {
      const created = await service.createInvestor(VALID_INPUT);

      const found = await service.getInvestorById(created.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.email).toBe(created.email);
      expect(found?.full_name).toBe(created.full_name);
    });

    it("returns a copy — mutating the result does not corrupt the store", async () => {
      const created = await service.createInvestor(VALID_INPUT);
      const found = await service.getInvestorById(created.id);

      // Deliberately mutate the returned record.
      if (found !== null) {
        (found as { full_name: string }).full_name = "MUTATED";
      }

      // Re-fetch: the store must be unaffected.
      const refetched = await service.getInvestorById(created.id);
      expect(refetched?.full_name).toBe(VALID_INPUT.full_name);
    });

    it("re-throws any AppError from the repository without mutation", async () => {
      const notFoundErr = AppError.notFound("Investor", "some-id");

      const brokenRepo = {
        create: jest.fn().mockResolvedValue({
          id: "00000000-0000-4000-8000-000000000000",
          full_name: "Test",
          email: "t@example.com",
          date_of_birth: validDob,
          country: "US",
          status: "pending_kyc",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
        findById: jest.fn().mockRejectedValue(notFoundErr),
      } as IInvestorRepository;

      const svc = new InvestorService(brokenRepo);
      await expect(svc.getInvestorById("some-id")).rejects.toBe(notFoundErr);
    });
  });
});
