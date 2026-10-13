import { z } from "zod";

const id = z.coerce.number().int().positive();

export const idParamSchema = z.object({ id });

export const createCallSchema = z.object({
  translatorId: z.number().int().positive(),
  languageId: z.number().int().positive(),
  themeId: z.number().int().positive(),
  type: z.enum(["AUDIO", "VIDEO"]).default("AUDIO"),
});

export const listCallsQuerySchema = z.object({
  status: z
    .enum(["REQUESTED", "ACCEPTED", "ACTIVE", "ENDED", "MISSED", "REJECTED", "FAILED"])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
