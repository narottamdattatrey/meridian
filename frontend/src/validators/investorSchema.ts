/**
 * frontend/src/validators/investorSchema.ts
 *
 * Client-side Zod schema. Mirrors the backend schema but uses
 * browser-evaluated dates and relaxed field ordering for UX.
 */

import { z } from "zod";
import { SUPPORTED_COUNTRIES } from "../constants/countries";

const getMaxAllowedDob = (): Date => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d;
};

export const investorFormSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters.")
    .max(200, "Full name must not exceed 200 characters.")
    .regex(/^[\p{L}\p{M}' .-]+$/u, "Full name contains invalid characters."),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address.")
    .max(254, "Email must not exceed 254 characters."),

  date_of_birth: z
    .string()
    .min(1, "Date of birth is required.")
    .refine((dob) => {
      const parsed = new Date(dob);
      return !isNaN(parsed.getTime());
    }, "Please enter a valid date.")
    .refine(
      (dob) => new Date(dob) <= getMaxAllowedDob(),
      "You must be at least 18 years old to register."
    ),

  country: z
    .string()
    .min(1, "Please select a country.")
    .refine(
      (c) => SUPPORTED_COUNTRIES.map((cc) => cc.code).includes(c),
      "The selected country is not currently supported."
    ),
});

export type InvestorFormValues = z.infer<typeof investorFormSchema>;
