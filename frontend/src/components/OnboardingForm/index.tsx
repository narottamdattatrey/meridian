/**
 * frontend/src/components/OnboardingForm/index.tsx
 *
 * Investor onboarding form – Bootstrap 5 implementation.
 *
 * Features:
 *  – Zod-powered validation with per-field inline errors
 *  – Validates on blur + on submit (not on every keystroke)
 *  – Loading (spinner-border), success, and error states
 *  – Maps backend 409 DUPLICATE_EMAIL back to the email field
 *  – Maps backend VALIDATION_ERROR field map back to inline errors
 *  – Fully accessible (aria-invalid, aria-describedby, live regions)
 *  – Zero inline styles – all layout via Bootstrap 5 utility classes
 */

import React, {
  useCallback,
  useId,
  useReducer,
  useRef,
  type FormEvent,
} from "react";
import { ZodError } from "zod";
import { investorFormSchema, type InvestorFormValues } from "../../validators/investorSchema";
import { submitInvestorOnboarding } from "../../api/investorApi";
import { SUPPORTED_COUNTRIES } from "../../constants/countries";
import type { InvestorRecord } from "@meridian/shared";

// ─────────────────────────────────────────────────────────────
//  State machine
// ─────────────────────────────────────────────────────────────

type FieldErrors = Partial<Record<keyof InvestorFormValues, string>>;

type FormState =
  | { phase: "idle"; fields: InvestorFormValues; errors: FieldErrors; touched: Partial<Record<keyof InvestorFormValues, boolean>>; submitError: string | null }
  | { phase: "submitting"; fields: InvestorFormValues }
  | { phase: "success"; investor: InvestorRecord }
  | { phase: "error"; fields: InvestorFormValues; errors: FieldErrors; submitError: string };

type FormAction =
  | { type: "SET_FIELD"; field: keyof InvestorFormValues; value: string }
  | { type: "TOUCH_FIELD"; field: keyof InvestorFormValues }
  | { type: "SET_FIELD_ERRORS"; errors: FieldErrors }
  | { type: "SUBMIT" }
  | { type: "SUBMIT_SUCCESS"; investor: InvestorRecord }
  | { type: "SUBMIT_FAILURE"; submitError: string; fieldErrors?: FieldErrors };

const EMPTY_FIELDS: InvestorFormValues = {
  full_name: "",
  email: "",
  date_of_birth: "",
  country: "",
};

const initialState: FormState = {
  phase: "idle",
  fields: EMPTY_FIELDS,
  errors: {},
  touched: {},
  submitError: null,
};

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SET_FIELD": {
      if (state.phase === "submitting" || state.phase === "success") return state;
      const fields = { ...state.fields, [action.field]: action.value };

      const isTouched =
        state.phase === "error" ||
        (state.phase === "idle" && state.touched[action.field]);

      let errors = state.phase === "idle"
        ? state.errors
        : (state as Extract<FormState, { phase: "error" }>).errors;

      if (isTouched) {
        const result = investorFormSchema.shape[action.field].safeParse(action.value);
        errors = {
          ...errors,
          [action.field]: result.success ? undefined : result.error.issues[0]?.message,
        };
      }

      if (state.phase === "idle") {
        return { ...state, fields, errors };
      }
      return { ...state, phase: "idle", fields, errors, touched: {}, submitError: null };
    }

    case "TOUCH_FIELD": {
      if (state.phase !== "idle") return state;
      const touched = { ...state.touched, [action.field]: true };
      const result = investorFormSchema.shape[action.field].safeParse(
        state.fields[action.field]
      );
      const errors = {
        ...state.errors,
        [action.field]: result.success ? undefined : result.error.issues[0]?.message,
      };
      return { ...state, touched, errors };
    }

    case "SET_FIELD_ERRORS":
      if (state.phase !== "idle") return state;
      return { ...state, errors: action.errors };

    case "SUBMIT":
      if (state.phase === "submitting" || state.phase === "success") return state;
      return { phase: "submitting", fields: state.fields };

    case "SUBMIT_SUCCESS":
      return { phase: "success", investor: action.investor };

    case "SUBMIT_FAILURE":
      return {
        phase: "error",
        fields: state.phase === "success" ? EMPTY_FIELDS : state.fields,
        errors: action.fieldErrors ?? {},
        submitError: action.submitError,
      };

    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────────
//  Sub-components
// ─────────────────────────────────────────────────────────────

interface FieldWrapperProps {
  id: string;
  label: string;
  error?: string | undefined;
  required?: boolean | undefined;
  children: React.ReactNode;
}

/**
 * Bootstrap form-group wrapper.
 *
 * Renders:
 *   <div class="mb-3">
 *     <label class="form-label fw-medium">…</label>
 *     {children}                       ← Input / Select
 *     <div class="invalid-feedback">…  ← Only when error is set
 *   </div>
 *
 * The .invalid-feedback div is always rendered in the DOM so Bootstrap's
 * CSS transition plays smoothly; it becomes visible when the sibling
 * control carries .is-invalid.
 */
const FieldWrapper: React.FC<FieldWrapperProps> = ({
  id,
  label,
  error,
  required = false,
  children,
}) => (
  <div className="mb-3">
    <label htmlFor={id} className="form-label fw-medium mb-1">
      {label}
      {required && (
        <span className="text-danger ms-1" aria-hidden="true">*</span>
      )}
    </label>
    {children}
    {/* invalid-feedback must follow the form-control directly in DOM order */}
    <div
      id={`${id}-error`}
      className="invalid-feedback d-block"
      role={error ? "alert" : undefined}
      aria-live="polite"
    >
      {error ?? ""}
    </div>
  </div>
);

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  error?: string | undefined;
}

/**
 * Bootstrap-styled text input.
 *
 * – .form-control gives padding, border, and focus ring from theme.scss tokens
 * – .is-invalid activates red border + makes .invalid-feedback visible
 */
const Input: React.FC<InputProps> = ({ id, error, className, ...rest }) => (
  <input
    id={id}
    aria-invalid={error ? "true" : "false"}
    aria-describedby={error ? `${id}-error` : undefined}
    className={["form-control", error ? "is-invalid" : "", className ?? ""]
      .filter(Boolean)
      .join(" ")}
    {...rest}
  />
);

// ─────────────────────────────────────────────────────────────
//  Step progress indicator  (3 steps: Details → Review → Done)
// ─────────────────────────────────────────────────────────────

interface StepIndicatorProps {
  /** 1-based current step index */
  current: 1 | 2 | 3;
}

const STEPS = ["Your Details", "Review", "Confirmed"] as const;

const StepIndicator: React.FC<StepIndicatorProps> = ({ current }) => (
  <div className="step-indicator mb-4" aria-label="Onboarding progress">
    {STEPS.map((label, i) => {
      const step = (i + 1) as 1 | 2 | 3;
      const isDone = step < current;
      const isActive = step === current;
      return (
        <React.Fragment key={label}>
          {i > 0 && (
            <div
              className={`step-connector${isDone ? " done" : ""}`}
              aria-hidden="true"
            />
          )}
          <div
            className={`step${isActive ? " active" : ""}${isDone ? " done" : ""}`}
            aria-label={`Step ${step}: ${label}${isDone ? " (completed)" : isActive ? " (current)" : ""}`}
          >
            {isDone ? (
              // Checkmark SVG – inline, aria-hidden, no colour utilities needed
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                <path d="M1.5 6.5l3 3 6-6" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              step
            )}
          </div>
        </React.Fragment>
      );
    })}
  </div>
);

// ─────────────────────────────────────────────────────────────
//  Success screen
// ─────────────────────────────────────────────────────────────

const SuccessScreen: React.FC<{ investor: InvestorRecord }> = ({ investor }) => (
  <div role="status" aria-live="polite" className="text-center py-4">
    {/* Success icon badge */}
    <div className="d-inline-flex align-items-center justify-content-center rounded-circle bg-success bg-opacity-10 p-3 mb-3">
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-success"
        aria-hidden="true"
      >
        <path d="M20 6L9 17l-5-5" />
      </svg>
    </div>

    <h2 className="h4 fw-bold text-dark mb-2">Application Received</h2>
    <p className="text-secondary mb-4">
      Welcome, <strong className="text-dark">{investor.full_name}</strong>.
      Your application is pending KYC review. We&apos;ll contact you at{" "}
      <strong className="text-dark">{investor.email}</strong>.
    </p>

    {/* Summary table – Bootstrap list-group flush */}
    <ul className="list-group list-group-flush border rounded text-start small">
      <li className="list-group-item d-flex justify-content-between align-items-center">
        <span className="fw-medium text-secondary">Reference ID</span>
        <span className="ref-chip text-dark">
          {investor.id.split("-")[0]?.toUpperCase()}
        </span>
      </li>
      <li className="list-group-item d-flex justify-content-between align-items-center">
        <span className="fw-medium text-secondary">Status</span>
        <span className="badge bg-warning text-dark text-capitalize">
          {investor.status.replace("_", " ")}
        </span>
      </li>
      <li className="list-group-item d-flex justify-content-between align-items-center">
        <span className="fw-medium text-secondary">Country</span>
        <span className="text-dark">{investor.country}</span>
      </li>
      <li className="list-group-item d-flex justify-content-between align-items-center">
        <span className="fw-medium text-secondary">Date of Birth</span>
        <span className="text-dark">{investor.date_of_birth}</span>
      </li>
    </ul>
  </div>
);

// ─────────────────────────────────────────────────────────────
//  Main component
// ─────────────────────────────────────────────────────────────

const OnboardingForm: React.FC = () => {
  const [state, dispatch] = useReducer(formReducer, initialState);
  const uid = useId();
  const firstErrorRef = useRef<HTMLElement | null>(null);

  const fieldId = (name: string) => `${uid}-${name}`;

  const isDisabled =
    state.phase === "submitting" || state.phase === "success";

  const currentFields: InvestorFormValues =
    state.phase === "success" || state.phase === "submitting"
      ? EMPTY_FIELDS
      : state.fields;

  const currentErrors: FieldErrors =
    state.phase === "idle" || state.phase === "error" ? state.errors : {};

  const submitError =
    state.phase === "idle"
      ? state.submitError
      : state.phase === "error"
      ? state.submitError
      : null;

  const handleChange = useCallback(
    (field: keyof InvestorFormValues) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        dispatch({ type: "SET_FIELD", field, value: e.target.value });
      },
    []
  );

  const handleBlur = useCallback(
    (field: keyof InvestorFormValues) => () => {
      dispatch({ type: "TOUCH_FIELD", field });
    },
    []
  );

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isDisabled) return;

    const parseResult = investorFormSchema.safeParse(currentFields);

    if (!parseResult.success) {
      const zodError = parseResult.error as ZodError;
      const errors: FieldErrors = {};

      for (const issue of zodError.issues) {
        const key = issue.path[0] as keyof InvestorFormValues | undefined;
        if (key && !(key in errors)) {
          errors[key] = issue.message;
        }
      }

      dispatch({ type: "SET_FIELD_ERRORS", errors });

      const firstKey = Object.keys(errors)[0];
      if (firstKey) {
        const el = document.getElementById(fieldId(firstKey));
        (el as HTMLElement | null)?.focus();
        firstErrorRef.current = el;
      }
      return;
    }

    dispatch({ type: "SUBMIT" });
    const result = await submitInvestorOnboarding(parseResult.data);

    if (result.success) {
      dispatch({ type: "SUBMIT_SUCCESS", investor: result.data });
      return;
    }

    if (result.error.code === "DUPLICATE_EMAIL") {
      dispatch({
        type: "SUBMIT_FAILURE",
        submitError: "",
        fieldErrors: {
          email:
            "An account with this email already exists. Please sign in or use a different address.",
        },
      });
      const el = document.getElementById(fieldId("email"));
      (el as HTMLElement | null)?.focus();
      return;
    }

    if (
      result.error.code === "VALIDATION_ERROR" &&
      result.error.fields &&
      Object.keys(result.error.fields).length > 0
    ) {
      const fieldErrors: FieldErrors = {};
      for (const [key, msg] of Object.entries(result.error.fields)) {
        if (key in EMPTY_FIELDS) {
          fieldErrors[key as keyof InvestorFormValues] = msg;
        }
      }
      dispatch({
        type: "SUBMIT_FAILURE",
        submitError: result.error.message,
        fieldErrors,
      });
      return;
    }

    dispatch({ type: "SUBMIT_FAILURE", submitError: result.error.message });
  };

  // ── Success view ────────────────────────────────────────────
  if (state.phase === "success") {
    return (
      <div className="card shadow-sm">
        <div className="card-body">
          <StepIndicator current={3} />
          <SuccessScreen investor={state.investor} />
        </div>
      </div>
    );
  }

  // ── Form view ───────────────────────────────────────────────
  return (
    <div className="card shadow-sm">
      <div className="card-body">
        <StepIndicator current={1} />

        {/* Card header */}
        <div className="mb-4">
          <h1 className="h4 fw-bold text-dark mb-1">Investor Onboarding</h1>
          <p className="text-secondary small mb-0">
            Create your investor account. All fields are required.
          </p>
        </div>

        {/* Global submit error alert */}
        {submitError && (
          <div
            role="alert"
            aria-live="assertive"
            className="alert alert-danger d-flex align-items-start gap-2 py-2 mb-4"
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
            <span>{submitError}</span>
          </div>
        )}

        <form
          noValidate
          onSubmit={(e) => { void handleSubmit(e); }}
        >
          {/* Full Name */}
          <FieldWrapper
            id={fieldId("full_name")}
            label="Full Name"
            error={currentErrors.full_name}
            required
          >
            <Input
              id={fieldId("full_name")}
              type="text"
              name="full_name"
              autoComplete="name"
              placeholder="e.g. Amelia Thornton"
              value={currentFields.full_name}
              onChange={handleChange("full_name")}
              onBlur={handleBlur("full_name")}
              disabled={isDisabled}
              error={currentErrors.full_name}
            />
          </FieldWrapper>

          {/* Email */}
          <FieldWrapper
            id={fieldId("email")}
            label="Email Address"
            error={currentErrors.email}
            required
          >
            <Input
              id={fieldId("email")}
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={currentFields.email}
              onChange={handleChange("email")}
              onBlur={handleBlur("email")}
              disabled={isDisabled}
              error={currentErrors.email}
            />
          </FieldWrapper>

          {/* Date of Birth + Country – side by side on md+ */}
          <div className="row g-3">
            <div className="col-12 col-md-6">
              <FieldWrapper
                id={fieldId("date_of_birth")}
                label="Date of Birth"
                error={currentErrors.date_of_birth}
                required
              >
                <Input
                  id={fieldId("date_of_birth")}
                  type="date"
                  name="date_of_birth"
                  autoComplete="bday"
                  max={new Date().toISOString().split("T")[0]}
                  value={currentFields.date_of_birth}
                  onChange={handleChange("date_of_birth")}
                  onBlur={handleBlur("date_of_birth")}
                  disabled={isDisabled}
                  error={currentErrors.date_of_birth}
                />
              </FieldWrapper>
            </div>

            <div className="col-12 col-md-6">
              <FieldWrapper
                id={fieldId("country")}
                label="Country of Residence"
                error={currentErrors.country}
                required
              >
                <select
                  id={fieldId("country")}
                  name="country"
                  autoComplete="country"
                  value={currentFields.country}
                  onChange={handleChange("country")}
                  onBlur={handleBlur("country")}
                  disabled={isDisabled}
                  aria-invalid={currentErrors.country ? "true" : "false"}
                  aria-describedby={
                    currentErrors.country
                      ? `${fieldId("country")}-error`
                      : undefined
                  }
                  className={[
                    "form-select",
                    currentErrors.country ? "is-invalid" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <option value="">Select a country…</option>
                  {SUPPORTED_COUNTRIES.map(({ code, label }) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </select>
              </FieldWrapper>
            </div>
          </div>

          {/* Submit button */}
          <div className="mt-2">
            <button
              type="submit"
              disabled={isDisabled}
              aria-busy={state.phase === "submitting"}
              className="btn btn-primary w-100 d-flex align-items-center justify-content-center gap-2"
            >
              {state.phase === "submitting" ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm"
                    role="status"
                    aria-hidden="true"
                  />
                  <span>Submitting…</span>
                </>
              ) : (
                "Create Account"
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Card footer – legal links */}
      <div className="card-footer bg-transparent text-center border-top-0 pb-3 pt-0">
        <p className="text-secondary small mb-0">
          By submitting you agree to our{" "}
          <a href="/terms" className="text-primary text-decoration-none fw-medium">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="/privacy" className="text-primary text-decoration-none fw-medium">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  );
};

export default OnboardingForm;
