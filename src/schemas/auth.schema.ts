import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().email("Fadlan geli email sax ah"),
  password: z.string().min(8, "Furaha sirta waa inuu ugu yaraan 8 xaraf yahay"),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Please enter your password"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email("Fadlan geli email sax ah"),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Furaha sirta waa inuu ugu yaraan 8 xaraf yahay"),
    confirmPassword: z.string().min(8, "Furaha sirta waa inuu ugu yaraan 8 xaraf yahay"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Furayaasha sirta isma eka / Passwords don't match",
    path: ["confirmPassword"],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
