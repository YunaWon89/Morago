import { z } from "zod";

export function normalizePhone(value: string): string {
  return value.replace(/[\s\-().]/g, "");
}

const phone = z
  .string()
  .trim()
  .transform(normalizePhone)
  .pipe(z.string().regex(/^\+?\d{8,15}$/, "Invalid phone number"));

const email = z.string().trim().toLowerCase().pipe(z.email("Invalid email"));

const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters");

export const sendCodeSchema = z.object({ phone });

export const registerSchema = z.object({
  phone,
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
  password,
  fullName: z.string().trim().min(2).max(150),
  email,
  role: z.enum(["USER", "TRANSLATOR"]),
});

export const loginSchema = z.object({
  login: z.string().trim().min(3, "Enter phone number or email"),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({ email });

export const verifyResetCodeSchema = z.object({
  phone,
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(32).max(128),
  password,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: password,
});

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(150),
});
