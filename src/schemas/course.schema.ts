import { z } from "zod";

export const COURSE_CATEGORIES = ["Mobile", "Web Development"] as const;

export const courseSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(120),
  description: z
    .string()
    .min(10, "Please write a short description (at least 10 characters)"),
  category: z.enum(COURSE_CATEGORIES, {
    errorMap: () => ({ message: "Choose a category" }),
  }),
  price: z
    .string()
    .min(1, "Enter a price (0 for free)")
    .refine(
      (v) => !Number.isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 10000,
      "Enter a valid price between 0 and 10000"
    ),
  compare_at_price: z
    .string()
    .refine(
      (v) =>
        v.trim() === "" ||
        (!Number.isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 10000),
      "Geli qiime sax ah (ama bannaan ka tag)"
    ),
});
export type CourseInput = z.infer<typeof courseSchema>;

export const lessonSchema = z.object({
  title: z.string().min(2, "Lesson title is too short").max(160),
  description: z.string(),
  is_preview: z.boolean(),
});
export type LessonInput = z.infer<typeof lessonSchema>;

/** Somali mobile-money wallets supported by WaafiPay (routes by number). */
export const PAYMENT_CHANNELS = [
  { value: "EVC", label: "EVC Plus", placeholder: "615 123 456" },
  { value: "ZAAD", label: "ZAAD", placeholder: "634 123 456" },
  { value: "SAHAL", label: "Sahal", placeholder: "907 123 456" },
] as const;

export const paymentSchema = z.object({
  payment_channel: z.enum(["EVC", "ZAAD", "SAHAL"], {
    errorMap: () => ({ message: "Dooro EVC Plus, ZAAD ama Sahal" }),
  }),
  phone_number: z
    .string()
    .regex(
      /^(\+?252|0)?\d{8,9}$/,
      "Geli lambar mobile Soomaali ah oo sax ah, tusaale 61XXXXXXX"
    ),
});
export type PaymentInput = z.infer<typeof paymentSchema>;

export const profileSchema = z.object({
  full_name: z.string().min(2, "Please enter your full name").max(80),
});
export type ProfileInput = z.infer<typeof profileSchema>;
