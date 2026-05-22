/**
 * backend/__tests__/setup.ts
 *
 * Jest global setup file — runs once per worker before any module is imported.
 *
 * Sets LOG_LEVEL=silent so the pino logger never emits structured JSON into
 * Jest's output buffer.  The logger reads this variable at module-load time,
 * so it must be set here (in setupFiles) rather than in a beforeAll hook.
 */
process.env["LOG_LEVEL"] = "silent";
process.env["NODE_ENV"] = "test";
