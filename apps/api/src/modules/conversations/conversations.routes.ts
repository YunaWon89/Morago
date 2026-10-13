import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import {
  createConversationSchema,
  idParamSchema,
  listMessagesQuerySchema,
  sendMessageSchema,
} from "./conversations.schemas.js";
import {
  getOrCreateConversation,
  listConversations,
  listMessages,
  markConversationRead,
  sendMessage,
} from "./conversations.service.js";

export const conversationsRouter = Router();

conversationsRouter.use(requireAuth);

conversationsRouter.get("/", async (req, res) => {
  res.json(await listConversations(req.user!));
});

// Only a client can open a chat with a translator; translators reply in existing chats.
conversationsRouter.post("/", requireRole("USER"), async (req, res) => {
  const { translatorId } = createConversationSchema.parse(req.body ?? {});
  res.json({ conversation: await getOrCreateConversation(req.user!, translatorId) });
});

conversationsRouter.get("/:id/messages", async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const query = listMessagesQuerySchema.parse(req.query);
  res.json(await listMessages(id, req.user!, query));
});

conversationsRouter.post("/:id/messages", async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const input = sendMessageSchema.parse(req.body ?? {});
  res.status(201).json({ message: await sendMessage(id, req.user!, input) });
});

conversationsRouter.post("/:id/read", async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await markConversationRead(id, req.user!));
});
