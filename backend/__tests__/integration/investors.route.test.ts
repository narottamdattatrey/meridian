/**
 * backend/__tests__/integration/investors.route.test.ts
 *
 * End-to-end integration tests for the investor HTTP API.
 *
 * Scope
 * ─────
 * Exercises the full request→router→service→repository→file chain in a
 * sandboxed environment, verifying:
 *   • HTTP status codes
 *   • JSON body shape and values
 *   • Persistence to the sandboxed file store
 *   • Domain-level constraints (duplicate email, age gate, UUID validation)
 *
 * Sandbox strategy
 * ────────────────
 * jest.mock replaces FileInvestorRepository with a subclass that writes to
 * a temporary OS directory instead of the production data path.
 * jest.mock is hoisted above all imports by ts-jest/babel-jest, so the
 * mock is in place before any application module is evaluated — including
 * the routes module that calls `new InvestorService()` at module scope.
 *
 * Lifecycle
 * ─────────
 *  beforeEach  → delete the test JSON file (clean slate per test)
 *  afterAll    → remove the entire sandbox directory
 *
 * Routes under test
 * ─────────────────
 *  POST /api/v1/investors
 *  GET  /api/v1/investors/:id
 */

import os from "os";
import path from "path";
import fs from "fs/promises";
import request from "supertest";
import type { IInvestorRepository } from "../../repositories/investorRepository";

// ── Sandbox path constants ─────────────────────────────────────────────────
// Defined before the jest.mock factory.  In CommonJS + ts-jest the factory
// runs lazily (at the first require() of the mocked module), by which point
// these consts are initialised.
const SANDBOX_DIR = path.join(os.tmpdir(), "meridian-test");
const SANDBOX_STORE = path.join(SANDBOX_DIR, "investors_test_store.json");

// ── Module mock ────────────────────────────────────────────────────────────
// Replace FileInvestorRepository with a sandboxed subclass BEFORE the routes
// module loads.  The factory uses require() (CommonJS) for os/path because
// ESM-style imports are not available inside jest.mock factories.
jest.mock("../../repositories/investorRepository", () => {
  const actual = jest.requireActual<{
    FileInvestorRepository: new (filePath?: string) => IInvestorRepository;
    [key: string]: unknown;
  }>("../../repositories/investorRepository");

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const osModule = require("os") as typeof import("os");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pathModule = require("path") as typeof import("path");

  const sandboxPath = pathModule.join(
    osModule.tmpdir(),
    "meridian-test",
    "investors_test_store.json"
  );

  class SandboxedFileInvestorRepository extends actual.FileInvestorRepository {
    constructor() {
      super(sandboxPath);
    }
  }

  return { ...actual, FileInvestorRepository: SandboxedFileInvestorRepository };
});

// ── Application factory ────────────────────────────────────────────────────
// Import AFTER jest.mock so the mock is active when app.ts is evaluated.
import { createApp } from "../../app";

const app = createApp();

// ── Fixtures ───────────────────────────────────────────────────────────────

/**
 * Generates a date-of-birth string for an investor exactly `years` years old,
 * so age-boundary tests remain correct on any calendar date.
 */
function dobForAge(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

const VALID_PAYLOAD = {
  full_name: "Jane Investor",
  email: "jane.investor@example.com",
  date_of_birth: dobForAge(30),
  country: "US",
} as const;

// RFC 4122 UUIDv4 — group widths: 8-4-4-4-12, version nibble = 4
const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ── Lifecycle hooks ────────────────────────────────────────────────────────

beforeEach(async () => {
  // Wipe only the store file so each test starts with an empty collection.
  // force:true means the call is a no-op when the file does not yet exist.
  await fs.rm(SANDBOX_STORE, { force: true });
});

afterAll(async () => {
  // Remove the whole sandbox directory tree after the suite finishes.
  await fs.rm(SANDBOX_DIR, { recursive: true, force: true });
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/v1/investors
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/v1/investors", () => {
  // ── 201 success path ────────────────────────────────────────────────────

  it("201 – creates an investor and returns the persisted record", async () => {
    const res = await request(app)
      .post("/api/v1/investors")
      .send(VALID_PAYLOAD)
      .set("Content-Type", "application/json");

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const record: Record<string, unknown> = res.body.data;

    // Auto-generated fields
    expect(record["id"]).toMatch(UUID_V4_RE);
    expect(typeof record["created_at"]).toBe("string");
    expect(typeof record["updated_at"]).toBe("string");

    // Input fields echoed back
    expect(record["full_name"]).toBe(VALID_PAYLOAD.full_name);
    expect(record["date_of_birth"]).toBe(VALID_PAYLOAD.date_of_birth);
    expect(record["country"]).toBe("US");

    // Email is normalised to lowercase by the Zod transform
    expect(record["email"]).toBe(VALID_PAYLOAD.email.toLowerCase());

    // Default lifecycle state
    expect(record["status"]).toBe("pending_kyc");
  });

  it("201 – normalises a mixed-case email to lowercase before storing", async () => {
    const res = await request(app)
      .post("/api/v1/investors")
      .send({ ...VALID_PAYLOAD, email: "Jane.Investor@EXAMPLE.COM" })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe("jane.investor@example.com");
  });

  it("201 – data is durably written to the sandbox JSON file", async () => {
    await request(app)
      .post("/api/v1/investors")
      .send(VALID_PAYLOAD)
      .set("Content-Type", "application/json");

    const raw = await fs.readFile(SANDBOX_STORE, "utf-8");
    const stored = JSON.parse(raw) as unknown[];

    expect(stored).toHaveLength(1);
    expect((stored[0] as Record<string, unknown>)["email"]).toBe(
      VALID_PAYLOAD.email.toLowerCase()
    );
  });

  it("201 – two different emails produce two independent records", async () => {
    await request(app)
      .post("/api/v1/investors")
      .send(VALID_PAYLOAD)
      .set("Content-Type", "application/json");

    await request(app)
      .post("/api/v1/investors")
      .send({ ...VALID_PAYLOAD, email: "second.investor@example.com" })
      .set("Content-Type", "application/json");

    const raw = await fs.readFile(SANDBOX_STORE, "utf-8");
    const stored = JSON.parse(raw) as Array<{ id: string }>;

    expect(stored).toHaveLength(2);
    // Each record gets a distinct UUIDv4
    expect(stored[0]?.id).not.toBe(stored[1]?.id);
  });

  // ── 409 duplicate email ──────────────────────────────────────────────────

  it("409 – returns DUPLICATE_EMAIL when the exact same email is submitted twice", async () => {
    // Seed a record
    await request(app)
      .post("/api/v1/investors")
      .send(VALID_PAYLOAD)
      .set("Content-Type", "application/json");

    // Duplicate attempt
    const res = await request(app)
      .post("/api/v1/investors")
      .send({ ...VALID_PAYLOAD, full_name: "Jane Duplicate" })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("DUPLICATE_EMAIL");
  });

  it("409 – duplicate detection is case-insensitive across Zod transform and repository", async () => {
    await request(app)
      .post("/api/v1/investors")
      .send(VALID_PAYLOAD)
      .set("Content-Type", "application/json");

    // Zod lowercases the email before it reaches the repo, so this must clash.
    const res = await request(app)
      .post("/api/v1/investors")
      .send({ ...VALID_PAYLOAD, email: VALID_PAYLOAD.email.toUpperCase() })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DUPLICATE_EMAIL");
  });

  it("409 – response body follows the structured AppErrorResponse shape", async () => {
    await request(app)
      .post("/api/v1/investors")
      .send(VALID_PAYLOAD)
      .set("Content-Type", "application/json");

    const res = await request(app)
      .post("/api/v1/investors")
      .send(VALID_PAYLOAD)
      .set("Content-Type", "application/json");

    expect(res.body).toMatchObject({
      success: false,
      error: {
        code: "DUPLICATE_EMAIL",
        message: expect.any(String),
      },
    });
  });

  // ── 400 age boundary ────────────────────────────────────────────────────

  it("400 – rejects an investor under 18 with VALIDATION_ERROR on date_of_birth", async () => {
    // 16 years old — safely below the 18-year threshold on any test date
    const res = await request(app)
      .post("/api/v1/investors")
      .send({ ...VALID_PAYLOAD, date_of_birth: dobForAge(16) })
      .set("Content-Type", "application/json");

    // Zod's .refine(dob <= maxAllowedDob()) fires first, before the
    // repository ever runs its own age check.
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.fields).toHaveProperty("date_of_birth");
    expect(res.body.error.fields.date_of_birth).toMatch(/18/);
  });

  it("400 – also rejects a date-of-birth that is exactly today (age 0)", async () => {
    const today = new Date().toISOString().slice(0, 10);

    const res = await request(app)
      .post("/api/v1/investors")
      .send({ ...VALID_PAYLOAD, date_of_birth: today })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.fields).toHaveProperty("date_of_birth");
  });

  // ── 400 payload validation ───────────────────────────────────────────────

  it("400 – VALIDATION_ERROR when all required fields are absent", async () => {
    const res = await request(app)
      .post("/api/v1/investors")
      .send({})
      .set("Content-Type", "application/json");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    // Every required field must surface an error message
    expect(res.body.error.fields).toHaveProperty("full_name");
    expect(res.body.error.fields).toHaveProperty("email");
    expect(res.body.error.fields).toHaveProperty("date_of_birth");
    expect(res.body.error.fields).toHaveProperty("country");
  });

  it("400 – VALIDATION_ERROR for an invalid email format", async () => {
    const res = await request(app)
      .post("/api/v1/investors")
      .send({ ...VALID_PAYLOAD, email: "not-an-email" })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(400);
    expect(res.body.error.fields).toHaveProperty("email");
  });

  it("400 – VALIDATION_ERROR for a date_of_birth in non-ISO format", async () => {
    const res = await request(app)
      .post("/api/v1/investors")
      .send({ ...VALID_PAYLOAD, date_of_birth: "15/06/1990" })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(400);
    expect(res.body.error.fields).toHaveProperty("date_of_birth");
  });

  it("400 – VALIDATION_ERROR for a country code not in the supported list", async () => {
    const res = await request(app)
      .post("/api/v1/investors")
      .send({ ...VALID_PAYLOAD, country: "ZZ" }) // not in SUPPORTED_COUNTRY_CODES
      .set("Content-Type", "application/json");

    expect(res.status).toBe(400);
    expect(res.body.error.fields).toHaveProperty("country");
  });

  it("400 – VALIDATION_ERROR for a full_name that is too short", async () => {
    const res = await request(app)
      .post("/api/v1/investors")
      .send({ ...VALID_PAYLOAD, full_name: "A" }) // min 2 chars
      .set("Content-Type", "application/json");

    expect(res.status).toBe(400);
    expect(res.body.error.fields).toHaveProperty("full_name");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v1/investors/:id
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/v1/investors/:id", () => {
  // ── 200 success path ────────────────────────────────────────────────────

  it("200 – returns the full investor record for a valid, existing UUID", async () => {
    // Seed a record via POST first
    const postRes = await request(app)
      .post("/api/v1/investors")
      .send(VALID_PAYLOAD)
      .set("Content-Type", "application/json");

    const { id } = postRes.body.data as { id: string };

    const res = await request(app).get(`/api/v1/investors/${id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(id);
    expect(res.body.data.full_name).toBe(VALID_PAYLOAD.full_name);
    expect(res.body.data.email).toBe(VALID_PAYLOAD.email.toLowerCase());
    expect(res.body.data.date_of_birth).toBe(VALID_PAYLOAD.date_of_birth);
    expect(res.body.data.country).toBe(VALID_PAYLOAD.country);
    expect(res.body.data.status).toBe("pending_kyc");
  });

  it("200 – returned data matches exactly what was stored on disk", async () => {
    const postRes = await request(app)
      .post("/api/v1/investors")
      .send(VALID_PAYLOAD)
      .set("Content-Type", "application/json");

    const { id } = postRes.body.data as { id: string };

    // Read directly from the sandbox file for a ground-truth comparison.
    const raw = await fs.readFile(SANDBOX_STORE, "utf-8");
    const [storedRecord] = JSON.parse(raw) as Array<Record<string, unknown>>;

    const getRes = await request(app).get(`/api/v1/investors/${id}`);

    expect(getRes.body.data).toEqual(storedRecord);
  });

  // ── 404 not found ────────────────────────────────────────────────────────

  it("404 – NOT_FOUND for a well-formed UUID that does not exist in the store", async () => {
    // Nil UUID — structurally valid UUIDv4 but guaranteed to be absent.
    const res = await request(app).get(
      "/api/v1/investors/00000000-0000-4000-8000-000000000000"
    );

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(res.body.error.message).toContain("00000000-0000-4000-8000-000000000000");
  });

  // ── 400 malformed id ─────────────────────────────────────────────────────

  it("400 – INVALID_UUID for a path parameter that is not a UUID string", async () => {
    const res = await request(app).get("/api/v1/investors/not-a-valid-uuid");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("INVALID_UUID");
  });

  it("400 – INVALID_UUID for a purely numeric path parameter", async () => {
    const res = await request(app).get("/api/v1/investors/123456789");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_UUID");
  });

  it("400 – INVALID_UUID for a UUID-like string with the wrong segment count", async () => {
    const res = await request(app).get(
      "/api/v1/investors/00000000-0000-0000-0000" // only 4 groups
    );

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_UUID");
  });

  it("400 – INVALID_UUID for a SQL-injection-style path parameter", async () => {
    const res = await request(app).get(
      "/api/v1/investors/' OR '1'='1"
    );

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_UUID");
  });

  // ── Response shape invariant ─────────────────────────────────────────────

  it("every error response follows the AppErrorResponse envelope", async () => {
    const responses = await Promise.all([
      request(app).get("/api/v1/investors/bad-id"),
      request(app).get("/api/v1/investors/00000000-0000-4000-8000-000000000000"),
    ]);

    for (const res of responses) {
      expect(res.body).toMatchObject({
        success: false,
        error: {
          code: expect.any(String),
          message: expect.any(String),
        },
      });
    }
  });
});
