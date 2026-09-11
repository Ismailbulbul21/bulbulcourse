import { z } from "zod";
import { paymentSchema } from "./course.schema";

export const SERVICE_CATEGORIES = [
  { value: "mobile", label: "Mobile App" },
  { value: "web", label: "Website" },
  { value: "system", label: "System / Dashboard" },
  { value: "other", label: "Kale / Other" },
] as const;

export const inquirySchema = z.object({
  name: z.string().trim().min(2, "Geli magacaaga").max(80),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{7,20}$/, "Geli lambar taleefan oo sax ah"),
  email: z
    .string()
    .trim()
    .max(120)
    .refine((v) => v === "" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Email-ku sax ma aha"),
  project_type: z.enum(["mobile", "web", "system", "other"]),
  package_id: z.string(),
  budget: z.string().max(80),
  message: z
    .string()
    .trim()
    .min(10, "Fadlan wax yar ka sheeg mashruuca (ugu yaraan 10 xaraf)")
    .max(4000),
  /** Honeypot: hidden from people, filled in by bots. */
  website: z.string(),
});
export type InquiryFormInput = z.infer<typeof inquirySchema>;

/**
 * Booking checkout reuses the course checkout's wallet + phone rules
 * unchanged, plus what the student wants help with.
 */
export const bookingCheckoutSchema = paymentSchema.extend({
  topic: z.string().max(1000),
});
export type BookingCheckoutInput = z.infer<typeof bookingCheckoutSchema>;
