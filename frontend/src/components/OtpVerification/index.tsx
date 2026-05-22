/**
 * frontend/src/components/OtpVerification/index.tsx
 *
 * Step 2 — Email verification via a 6-digit OTP code.
 *
 * Features:
 *  – 6 individual digit inputs with auto-advance on entry
 *  – Backspace clears current digit and moves focus back
 *  – Paste distributes up to 6 digits across the boxes
 *  – Arrow-key navigation between boxes
 *  – 60-second countdown before "Resend Code" becomes available (mock reset)
 *  – Loading spinner while the API call is in-flight
 *  – Accessible: fieldset/legend, aria-labels, live error region
 *  – Zero inline styles — Bootstrap 5 utilities + .otp-input SCSS class only
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ClipboardEvent,
} from "react";
import type { InvestorRecord } from "@meridian/shared";
import { verifyOtp } from "../../api/otpApi";

// ── Constants ─────────────────────────────────────────────────────────────────

const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;
/** Shown in the hint so testers know which code to enter. */
const DEMO_CODE_HINT = "123456";

// ── Helpers ───────────────────────────────────────────────────────────────────

function maskEmail(email: string): string {
  const atIndex = email.indexOf("@");
  if (atIndex <= 0) return email;
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex); // includes the @
  const visible = local.slice(0, 1);
  const stars = "*".repeat(Math.min(local.length - 1, 4));
  return `${visible}${stars}${domain}`;
}

function emptyDigits(): string[] {
  return Array<string>(OTP_LENGTH).fill("");
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OtpVerificationProps {
  /** The investor record created in step 1 — used for investorId and email display. */
  investor: InvestorRecord;
  /** Called by the parent after successful verification. */
  onVerified: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

const OtpVerification: React.FC<OtpVerificationProps> = ({
  investor,
  onVerified,
}) => {
  const [digits, setDigits] = useState<string[]>(emptyDigits);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const inputRefs = useRef<Array<HTMLInputElement | null>>(
    Array<HTMLInputElement | null>(OTP_LENGTH).fill(null)
  );

  // ── Countdown timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = window.setTimeout(
      () => setSecondsLeft((prev) => prev - 1),
      1000
    );
    return () => window.clearTimeout(id);
  }, [secondsLeft]);

  // ── Derived state ──────────────────────────────────────────────────────────
  const code = digits.join("");
  const isComplete = code.length === OTP_LENGTH && /^\d{6}$/.test(code);

  // ── Focus helper ───────────────────────────────────────────────────────────
  const focusInput = useCallback((index: number) => {
    inputRefs.current[index]?.focus();
  }, []);

  // ── Input handlers ─────────────────────────────────────────────────────────

  const handleChange = useCallback(
    (index: number) =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        // Accept only the last digit typed (handles browser autocomplete pasting 6 chars)
        const digit = e.target.value.replace(/\D/g, "").slice(-1);
        setDigits((prev) => {
          const next = [...prev];
          next[index] = digit;
          return next;
        });
        setErrorMsg(null);
        if (digit && index < OTP_LENGTH - 1) {
          focusInput(index + 1);
        }
      },
    [focusInput]
  );

  const handleKeyDown = useCallback(
    (index: number) =>
      (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace") {
          e.preventDefault();
          setDigits((prev) => {
            const next = [...prev];
            if (next[index]) {
              next[index] = "";
              return next;
            }
            if (index > 0) {
              next[index - 1] = "";
              // Focus happens outside setState
            }
            return next;
          });
          if (!digits[index] && index > 0) {
            focusInput(index - 1);
          }
        } else if (e.key === "ArrowLeft" && index > 0) {
          focusInput(index - 1);
        } else if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
          focusInput(index + 1);
        }
      },
    [digits, focusInput]
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
      if (!text) return;
      const next = emptyDigits();
      for (let i = 0; i < text.length; i++) {
        next[i] = text[i] ?? "";
      }
      setDigits(next);
      setErrorMsg(null);
      focusInput(Math.min(text.length, OTP_LENGTH - 1));
    },
    [focusInput]
  );

  // ── Resend ─────────────────────────────────────────────────────────────────
  const handleResend = () => {
    setDigits(emptyDigits());
    setErrorMsg(null);
    setSecondsLeft(RESEND_SECONDS);
    // Focus first box so the user can re-enter immediately
    window.setTimeout(() => focusInput(0), 0);
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isComplete || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    const result = await verifyOtp({ investorId: investor.id, code });

    if (result.success) {
      // Parent handles the state transition; no need to set local state
      onVerified();
      return;
    }

    setIsSubmitting(false);
    setErrorMsg(result.error.message);
    // Clear boxes so the user re-enters the code from scratch
    setDigits(emptyDigits());
    window.setTimeout(() => focusInput(0), 0);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const maskedEmail = maskEmail(investor.email);
  const hasError = errorMsg !== null;

  return (
    <div>
      {/* Header */}
      <div className="text-center mb-4">
        <div className="d-inline-flex align-items-center justify-content-center rounded-circle bg-primary bg-opacity-10 p-3 mb-3">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-primary"
            aria-hidden="true"
          >
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M2 8l10 6 10-6" />
          </svg>
        </div>

        <h2 className="h4 fw-bold text-dark mb-1">Verify Your Email</h2>
        <p className="text-secondary small mb-0">
          We&apos;ve sent a 6-digit code to{" "}
          <strong className="text-dark">{maskedEmail}</strong>.{" "}
          Enter it below to confirm your account.
        </p>
      </div>

      {/* Demo hint */}
      <div className="alert alert-info py-2 small text-center mb-3">
        <strong>Demo:</strong> use code{" "}
        <strong className="font-monospace">{DEMO_CODE_HINT}</strong> to verify.
      </div>

      {/* Error alert */}
      {hasError && (
        <div
          role="alert"
          aria-live="assertive"
          className="alert alert-danger d-flex align-items-start gap-2 py-2 mb-3"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="flex-shrink-0 mt-1"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{errorMsg}</span>
        </div>
      )}

      <form noValidate onSubmit={(e) => { void handleSubmit(e); }}>
        {/* OTP digit inputs */}
        <fieldset className="mb-4">
          <legend className="form-label fw-medium text-center w-100 mb-3 small text-secondary">
            Enter 6-digit verification code
          </legend>

          <div
            className="d-flex justify-content-center gap-2"
            role="group"
            aria-label="6-digit verification code"
          >
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputRefs.current[i] = el;
                }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                onChange={handleChange(i)}
                onKeyDown={handleKeyDown(i)}
                onPaste={handlePaste}
                onFocus={(e) => { e.target.select(); }}
                autoComplete={i === 0 ? "one-time-code" : "off"}
                aria-label={`Digit ${i + 1} of 6`}
                disabled={isSubmitting}
                className={[
                  "otp-input form-control",
                  hasError ? "is-invalid" : "",
                  digit ? "is-filled" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              />
            ))}
          </div>
        </fieldset>

        {/* Submit */}
        <button
          type="submit"
          disabled={!isComplete || isSubmitting}
          className="btn btn-primary w-100 d-flex align-items-center justify-content-center gap-2"
        >
          {isSubmitting ? (
            <>
              <span
                className="spinner-border spinner-border-sm"
                role="status"
                aria-hidden="true"
              />
              <span>Verifying&hellip;</span>
            </>
          ) : (
            "Verify Code"
          )}
        </button>
      </form>

      {/* Resend countdown */}
      <div className="text-center mt-3 small text-secondary">
        {secondsLeft > 0 ? (
          <>
            Didn&apos;t receive a code? Resend in{" "}
            <strong className="text-dark">{secondsLeft}s</strong>
          </>
        ) : (
          <>
            Didn&apos;t receive a code?{" "}
            <button
              type="button"
              onClick={handleResend}
              className="btn btn-link p-0 small text-primary text-decoration-none fw-medium align-baseline"
            >
              Resend Code
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default OtpVerification;
