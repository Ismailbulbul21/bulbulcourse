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
