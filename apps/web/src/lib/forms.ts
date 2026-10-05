import { z } from 'zod';
import { BILLING_CYCLES, CURRENCIES, getPlan } from '@/lib/plans';

const phonePattern = /^\+?[\d\s()-]{7,20}$/;

const honeypot = z.string().max(0).optional();

export const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'mobile_banking', label: 'bKash / Nagad' },
  { value: 'card', label: 'Card (secure invoice link)' },
  { value: 'purchase_order', label: 'Purchase order' },
] as const;

export const orderSchema = z
  .object({
    plan: z.enum(['starter', 'business'], { message: 'Choose a plan' }),
    cycle: z.enum(BILLING_CYCLES),
    currency: z.enum(CURRENCIES),
    employees: z.coerce
      .number({ message: 'Enter the number of employees' })
      .int('Enter a whole number')
      .min(1, 'At least 1 employee'),
    companyName: z.string().trim().min(2, 'Enter your company name').max(120),
    contactName: z.string().trim().min(2, 'Enter your full name').max(80),
    email: z.string().trim().email('Enter a valid work email').max(160),
    phone: z.string().trim().regex(phonePattern, 'Enter a valid phone number'),
    country: z.string().trim().min(2, 'Enter your country').max(60),
    address: z.string().trim().max(200).optional().or(z.literal('')),
    paymentMethod: z.enum(
      PAYMENT_METHODS.map((m) => m.value) as [string, ...string[]],
      { message: 'Choose a payment method' },
    ),
    notes: z.string().trim().max(1000).optional().or(z.literal('')),
    acceptTerms: z.literal(true, { errorMap: () => ({ message: 'Please accept the terms to continue' }) }),
    website: honeypot,
  })
  .superRefine((value, ctx) => {
    const limit = getPlan(value.plan)?.employeeLimit;
    if (limit && value.employees > limit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['employees'],
        message: `This plan covers up to ${limit.toLocaleString('en-US')} employees — choose a larger plan or talk to sales`,
      });
    }
  });

export type OrderInput = z.input<typeof orderSchema>;
export type Order = z.output<typeof orderSchema>;

export const CONTACT_TOPICS = [
  { value: 'sales', label: 'Talk to sales' },
  { value: 'demo', label: 'Book a demo' },
  { value: 'support', label: 'Customer support' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'other', label: 'Something else' },
] as const;

export const COMPANY_SIZES = ['1–50', '51–250', '251–1,000', '1,000+'] as const;

export const contactSchema = z.object({
  topic: z.enum(CONTACT_TOPICS.map((t) => t.value) as [string, ...string[]]),
  name: z.string().trim().min(2, 'Enter your name').max(80),
  email: z.string().trim().email('Enter a valid email').max(160),
  phone: z
    .string()
    .trim()
    .regex(phonePattern, 'Enter a valid phone number')
    .optional()
    .or(z.literal('')),
  company: z.string().trim().max(120).optional().or(z.literal('')),
  companySize: z.enum(COMPANY_SIZES).optional().or(z.literal('')),
  plan: z.string().max(20).optional().or(z.literal('')),
  message: z.string().trim().min(10, 'Tell us a little more (at least 10 characters)').max(2000),
  website: honeypot,
});

export type ContactInput = z.input<typeof contactSchema>;
export type Contact = z.output<typeof contactSchema>;

export type FieldErrors = Partial<Record<string, string>>;

export type SubmitResult =
  | { ok: true; reference: string }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

export function flattenErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.');
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}
