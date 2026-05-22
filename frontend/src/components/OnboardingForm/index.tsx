/**
 * frontend/src/components/OnboardingForm/index.tsx
 *
 * Investor onboarding form.
 *
 * Features:
 *  – Zod-powered validation with per-field inline errors
 *  – Validates on blur + on submit (not on every keystroke)
 *  – Loading, success, and error states
 *  – Maps backend 409 DUPLICATE_EMAIL back to the email field
 *  – Maps backend VALIDATION_ERROR field map back to inline errors
 *  – Fully accessible (aria-invalid, aria-describedby, live regions)
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
import type { InvestorRecord } from "../../types/api";

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

      // Re-validate the changed field if it's been touched
      const isTouched =
        state.phase === "error" ||
        (state.phase === "idle" && state.touched[action.field]);

      let errors = state.phase === "idle" ? state.errors : (state as Extract<FormState, { phase: "error" }>).errors;

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

      // Validate on blur
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
        fields: state.fields,
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
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}

const FieldWrapper: React.FC<FieldWrapperProps> = ({
  id,
  label,
  error,
  required = false,
  children,
}) => (
  <div className="flex flex-col gap-1">
    <label htmlFor={id} className="text-sm font-medium text-gray-700">
      {label}
      {required && (
        <span className="ml-1 text-red-500" aria-hidden="true">
          *
        </span>
      )}
    </label>
    {children}
    {error && (
      <p id={`${id}-error`} role="alert" className="text-xs text-red-600 mt-0.5">
        {error}
      </p>
    )}
  </div>
);

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  error?: string;
}

const Input: React.FC<InputProps> = ({ id, error, ...rest }) => (
  <input
    id={id}
    aria-invalid={error ? "true" : "false"}
    aria-describedby={error ? `${id}-error` : undefined}
    className={[
      "w-full rounded-lg border px-3 py-2 text-sm shadow-sm",
      "focus:outline-none focus:ring-2",
      error
        ? "border-red-400 focus:ring-red-300"
        : "border-gray-300 focus:ring-indigo-400",
      rest.disabled ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-white",
    ].join(" ")}
    {...rest}
  />
);

// ─────────────────────────────────────────────────────────────
//  Success screen
// ─────────────────────────────────────────────────────────────

const SuccessScreen: React.FC<{ investor: InvestorRecord }> = ({ investor }) => (
  <div
    role="status"
    aria-live="polite"
    className="flex flex-col items-center gap-4 py-10 text-center"
  >
    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
      <svg
        className="h-8 w-8 text-green-600"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </div>
    <h2 className="text-xl font-semibold text-gray-900">Application Received</h2>
    <p className="max-w-sm text-sm text-gray-600">
      Welcome, <strong>{investor.full_name}</strong>. Your application has been submitted
      and is pending KYC review. We'll contact you at{" "}
      <strong>{investor.email}</strong>.
    </p>
    <dl className="mt-2 w-full max-w-xs rounded-lg border border-gray-200 bg-gray-50 p-4 text-left text-xs text-gray-500">
      <div className="flex justify-between py-1">
        <dt className="font-medium">Reference ID</dt>
        <dd className="font-mono">{investor.id.split("-")[0]?.toUpperCase()}</dd>
      </div>
      <div className="flex justify-between py-1">
        <dt className="font-medium">Status</dt>
        <dd className="capitalize">{investor.status.replace("_", " ")}</dd>
      </div>
      <div className="flex justify-between py-1">
        <dt className="font-medium">Country</dt>
        <dd>{investor.country}</dd>
      </div>
    </dl>
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

  const currentFields =
    state.phase === "success" ? EMPTY_FIELDS : state.fields;

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

    // Full client-side validation before network call
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

      // Focus the first errored field for accessibility
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

    // Map structured backend errors back to the form
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

    dispatch({
      type: "SUBMIT_FAILURE",
      submitError: result.error.message,
    });
  };

  if (state.phase === "success") {
    return (
      <div className="mx-auto w-full max-w-md">
        <SuccessScreen investor={state.investor} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md">
      {/* Card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-lg">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Investor Onboarding
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Create your investor account. All fields are required.
          </p>
        </div>

        {/* Global submit error (non-field) */}
        {submitError && (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {submitError}
          </div>
        )}

        <form
          noValidate
          onSubmit={(e) => { void handleSubmit(e); }}
          className="flex flex-col gap-5"
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

          {/* Date of Birth */}
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

          {/* Country */}
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
                currentErrors.country ? `${fieldId("country")}-error` : undefined
              }
              className={[
                "w-full rounded-lg border px-3 py-2 text-sm shadow-sm",
                "focus:outline-none focus:ring-2",
                currentErrors.country
                  ? "border-red-400 focus:ring-red-300"
                  : "border-gray-300 focus:ring-indigo-400",
                isDisabled
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-white",
              ].join(" ")}
            >
              <option value="">Select a country…</option>
              {SUPPORTED_COUNTRIES.map(({ code, label }) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </FieldWrapper>

          {/* Submit */}
          <button
            type="submit"
            disabled={isDisabled}
            aria-busy={state.phase === "submitting"}
            className={[
              "mt-2 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5",
              "text-sm font-semibold text-white shadow-sm transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2",
              isDisabled
                ? "cursor-not-allowed bg-indigo-400"
                : "bg-indigo-600 hover:bg-indigo-700",
            ].join(" ")}
          >
            {state.phase === "submitting" ? (
              <>
                {/* Spinner */}
                <svg
                  className="h-4 w-4 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
                Submitting…
              </>
            ) : (
              "Create Account"
            )}
          </button>
        </form>
      </div>

      <p className="mt-4 text-center text-xs text-gray-400">
        By submitting you agree to our{" "}
        <a href="/terms" className="underline hover:text-indigo-600">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="/privacy" className="underline hover:text-indigo-600">
          Privacy Policy
        </a>
        .
      </p>
    </div>
  );
};

export default OnboardingForm;
