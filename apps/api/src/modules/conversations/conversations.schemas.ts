import { z } from "zod";

const id = z.coerce.number().int().positive();

export const idParamSchema = z.object({ id });

export const createConversationSchema = z.object({
  translatorId: z.number().int().positive(),
});

export const listMessagesQuerySchema = z.object({
  beforeId: id.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const sendMessageSchema = z.object({
  text: z.string().trim().min(1, "Message is empty").max(2000),
  callId: z.number().int().positive().optional(),
});
