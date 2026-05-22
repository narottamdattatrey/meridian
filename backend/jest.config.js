// backend/jest.config.js
// CommonJS config — avoids the ts-jest bootstrap chicken-and-egg issue
// that arises when jest.config.ts itself needs ts-jest to be parsed.

/** @type {import("jest").Config} */
const config = {
  testEnvironment: "node",

  // ── TypeScript transform ──────────────────────────────────────────────────
  // Point ts-jest at the backend's own tsconfig so every strictness flag
  // (noUncheckedIndexedAccess, exactOptionalPropertyTypes, etc.) is honoured
  // inside tests exactly as it is in production code.
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.json",
        // Diagnostics at error level only — warnings can be noisy in CI.
        diagnostics: { warnOnly: false },
      },
    ],
  },

  // ── Test discovery ────────────────────────────────────────────────────────
  testMatch: ["<rootDir>/__tests__/**/*.test.ts"],

  // ── Module resolution ─────────────────────────────────────────────────────
  // Mirror the tsconfig `paths` mapping so @meridian/shared resolves to
  // the shared package's source tree without a build step.
  moduleNameMapper: {
    "^@meridian/shared$": "<rootDir>/../packages/shared/src/index.ts",
  },

  // ── Global setup ──────────────────────────────────────────────────────────
  // Silence pino's structured JSON output during test runs so Jest's own
  // reporter is readable.  The setup file sets LOG_LEVEL=silent before
  // any module is imported.
  setupFiles: ["<rootDir>/__tests__/setup.ts"],

  // ── Isolation defaults ────────────────────────────────────────────────────
  clearMocks: true,    // reset mock.calls / mock.instances between tests
  restoreMocks: true,  // restore jest.spyOn originals after each test

  verbose: true,
};

module.exports = config;
