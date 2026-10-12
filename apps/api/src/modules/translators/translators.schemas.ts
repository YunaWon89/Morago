import { z } from "zod";

const id = z.coerce.number().int().positive();

export const idParamSchema = z.object({ id });

export const listQuerySchema = z.object({
  languageId: id.optional(),
  themeId: id.optional(),
  online: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  sort: z.enum(["rating", "price_asc", "price_desc"]).default("rating"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const updateProfileSchema = z
  .object({
    dateOfBirth: z.iso.date().nullable().optional(),
    topikLevel: z.number().int().min(0).max(6).nullable().optional(),
    pricePerMinute: z.number().int().min(0).max(1_000_000).optional(),
    languageIds: z.array(z.number().int().positive()).max(20).optional(),
    themes: z
      .array(
        z.object({
          themeId: z.number().int().positive(),
          withCertificate: z.boolean().default(false),
        }),
      )
      .max(100)
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update",
  });

export const onlineSchema = z.object({ isOnline: z.boolean() });
