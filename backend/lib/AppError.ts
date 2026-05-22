/**
 * backend/lib/AppError.ts
 *
 * Typed application error — the single propagation boundary between the
 * domain/repository layers and the HTTP response layer.
 *
 * Design goals:
 *  1. No HTTP framework import here (pure Node.js).
 *  2. Carries a machine-readable `code` (for API clients) and a
 *     human-readable `message` (for end-users / frontend display).
 *  3. `cause` preserves the original error for server-side logging
 *     without leaking internal details to the client.
 *  4. Optional `fields` map surfaces per-field validation feedback.
 *
 * Usage in a route handler:
 *
 *   throw new AppError(409, 'DUPLICATE_EMAIL',
 *     'An account with this email already exists.');
 *
 * Usage in the global error handler:
 *
 *   if (err instanceof AppError) {
 *     res.status(err.statusCode).json(err.toResponse());
 *   }
 */

export type AppErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_UUID"
  | "INVALID_OTP"
  | "NOT_FOUND"
  | "DUPLICATE_EMAIL"
  | "CONSTRAINT_VIOLATION"
  | "INTERNAL_ERROR";

export interface AppErrorResponse {
  success: false;
  error: {
    code: AppErrorCode;
    message: string;
    fields?: Record<string, string>;
  };
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: AppErrorCode;
  public readonly fields: Record<string, string> | undefined;
  public readonly cause: unknown;

  constructor(
    statusCode: number,
    code: AppErrorCode,
    message: string,
    options?: {
      fields?: Record<string, string>;
      cause?: unknown;
    }
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.fields = options?.fields;
    this.cause = options?.cause;

    // Restore prototype chain (required when extending built-ins in TS).
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /** Serialises to the structured JSON body the API sends to the client. */
  toResponse(): AppErrorResponse {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        ...(this.fields !== undefined ? { fields: this.fields } : {}),
      },
    };
  }

  // ── Factory helpers ──────────────────────────────────────────

  static validationError(
    fields: Record<string, string>,
    cause?: unknown
  ): AppError {
    return new AppError(400, "VALIDATION_ERROR", "One or more fields failed validation.", {
      fields,
      cause,
    });
  }

  static invalidUuid(paramName: string): AppError {
    return new AppError(
      400,
      "INVALID_UUID",
      `Path parameter '${paramName}' must be a valid UUIDv4.`
    );
  }

  static notFound(resource: string, id: string): AppError {
    return new AppError(404, "NOT_FOUND", `${resource} with id '${id}' was not found.`);
  }

  static duplicateEmail(): AppError {
    return new AppError(
      409,
      "DUPLICATE_EMAIL",
      "An account with this email address already exists. Please sign in or use a different address.",
      {
        fields: {
          email:
            "An account with this email address already exists.",
        },
      }
    );
  }

  static invalidOtp(): AppError {
    return new AppError(
      400,
      "INVALID_OTP",
      "Invalid verification code. Please check your email and try again.",
      {
        fields: { code: "Invalid or expired verification code." },
      }
    );
  }

  static internal(cause: unknown): AppError {
    return new AppError(
      500,
      "INTERNAL_ERROR",
      "An unexpected error occurred. Please try again later.",
      { cause }
    );
  }
}
