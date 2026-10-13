import { z } from "zod";

const id = z.coerce.number().int().positive();

export const idParamSchema = z.object({ id });

const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

export const listUsersQuerySchema = z.object({
  role: z.enum(["USER", "TRANSLATOR", "ADMIN"]).optional(),
  status: z.enum(["ACTIVE", "BLOCKED"]).optional(),
  search: z.string().trim().min(1).max(100).optional(),
  ...pagination,
});

export const blockUserSchema = z.object({
  reason: z.string().trim().min(3, "Reason is required").max(500),
});

export const listTranslatorsQuerySchema = z.object({
  status: z.enum(["REGISTERED", "INTERVIEW_SCHEDULED", "APPROVED", "REJECTED"]).optional(),
  ...pagination,
});

export const verificationSchema = z.object({
  status: z.enum(["INTERVIEW_SCHEDULED", "APPROVED", "REJECTED"]),
});

export const chargeSchema = z.object({
  amount: z.number().int().min(1).max(100_000_000),
});
