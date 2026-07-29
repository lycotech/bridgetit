import { z } from "zod";
import { api } from "@/lib/api";
import type { Attribution } from "@/lib/analytics";

export const WAITLIST_ROLES = [
  "Employee",
  "Employer or Business Leader",
  "HR or Payroll Professional",
  "Capital Provider or Investor",
  "Financial Institution",
  "Technology or Distribution Partner",
  "Media or Ecosystem Partner",
  "Other",
] as const;

export const waitlistFormSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter your full name").max(120),
  email: z.string().trim().email("Please enter a valid email address").max(200),
  phone: z.string().trim().min(6, "Please enter a valid phone number").max(40),
  organisation: z.string().trim().max(160).optional(),
  role: z.enum(WAITLIST_ROLES, { required_error: "Please choose how you are joining" }),
  goal: z.string().trim().max(1000).optional(),
  consent: z.literal(true, {
    errorMap: () => ({ message: "Please agree to receive PayBridge updates" }),
  }),
});

export type WaitlistForm = z.infer<typeof waitlistFormSchema>;

export interface WaitlistResult {
  id: string;
  status: "created" | "already_registered";
  createdAt: string;
}

export async function submitWaitlist(
  form: WaitlistForm,
  attribution: Attribution,
): Promise<WaitlistResult> {
  return api.post<WaitlistResult>("/api/waitlist", {
    ...form,
    organisation: form.organisation || undefined,
    goal: form.goal || undefined,
    ...attribution,
  });
}
