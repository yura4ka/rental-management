import { z } from "zod";

const email = z.string().trim().pipe(z.email("Enter a valid email address"));

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z.object({
  email,
  password: z
    .string()
    .min(12, "Password must be at least 12 characters")
    .max(128, "Password must be at most 128 characters")
    .refine((value) => value.trim().length > 0, "Password cannot be whitespace only"),
  role: z.enum(["Applicant", "PropertyManager"], { error: "Select a role" }),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
