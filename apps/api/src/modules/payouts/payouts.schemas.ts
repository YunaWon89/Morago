import { z } from "zod";

const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const createPayoutSchema = z.object({
  amount: z.number().int().min(1).max(100_000_000),
  bankName: z.string().trim().min(2).max(100),
  accountNumber: z.string().trim().min(4).max(50),
});

export const listPayoutsQuerySchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "PAID"]).optional(),
  ...pagination,
});

export const processPayoutSchema = z.object({
  status: z.enum(["PAID", "REJECTED"]),
});
