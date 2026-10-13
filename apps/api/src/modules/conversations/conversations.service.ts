import type { Prisma } from "../../../generated/prisma/client.js";
import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../../middleware/auth.js";
import { emitToUser } from "../../realtime/io.js";

const personSelect = { id: true, fullName: true, avatarFileId: true } as const;

function conversationInclude(userId: number) {
  return {
    client: { select: personSelect },
    translator: { include: { user: { select: personSelect } } },
    messages: { orderBy: { id: "desc" }, take: 1 },
    _count: { select: { messages: { where: { senderId: { not: userId }, readAt: null } } } },
  } satisfies Prisma.ConversationInclude;
}

type ConversationRow = Prisma.ConversationGetPayload<{
  include: ReturnType<typeof conversationInclude>;
}>;

function toConversationDto(conversation: ConversationRow, userId: number) {
  const iAmClient = conversation.clientId === userId;
  const other = iAmClient
    ? { ...conversation.translator.user, role: "TRANSLATOR" as const }
    : { ...conversation.client, role: "USER" as const };
  const last = conversation.messages[0] ?? null;

  return {
    id: conversation.id,
    createdAt: conversation.createdAt,
    lastMessageAt: conversation.lastMessageAt,
    other,
    lastMessage: last
      ? { id: last.id, text: last.text, senderId: last.senderId, createdAt: last.createdAt }
      : null,
    unreadCount: conversation._count.messages,
  };
}

function toMessageDto(message: {
  id: number;
  conversationId: number;
  senderId: number;
  callId: number | null;
  text: string;
  readAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    callId: message.callId,
    text: message.text,
    readAt: message.readAt,
    createdAt: message.createdAt,
  };
}

async function loadParticipantConversation(conversationId: number, userId: number) {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  // Do not reveal that someone else's conversation exists.
  if (!conversation || (conversation.clientId !== userId && conversation.translatorId !== userId)) {
    throw new HttpError(404, "Conversation not found");
  }
  return conversation;
}

export async function getOrCreateConversation(user: AuthUser, translatorId: number) {
  const translator = await prisma.translatorProfile.findFirst({
    where: { userId: translatorId, verificationStatus: "APPROVED", user: { status: "ACTIVE" } },
  });
  if (!translator) {
    throw new HttpError(404, "Translator not found");
  }

  const conversation = await prisma.conversation.upsert({
    where: { clientId_translatorId: { clientId: user.id, translatorId } },
    update: {},
    create: { clientId: user.id, translatorId },
    include: conversationInclude(user.id),
  });
  return toConversationDto(conversation, user.id);
}

export async function listConversations(user: AuthUser) {
  const rows = await prisma.conversation.findMany({
    where: { OR: [{ clientId: user.id }, { translatorId: user.id }] },
    include: conversationInclude(user.id),
  });

  // Conversations with the newest activity first; empty ones go last.
  const items = rows
    .map((row) => toConversationDto(row, user.id))
    .sort((a, b) => {
      const left = (a.lastMessageAt ?? a.createdAt).getTime();
      const right = (b.lastMessageAt ?? b.createdAt).getTime();
      return right - left;
    });

  return { items };
}

export async function listMessages(
  conversationId: number,
  user: AuthUser,
  query: { beforeId?: number; limit: number },
) {
  await loadParticipantConversation(conversationId, user.id);

  const rows = await prisma.message.findMany({
    where: { conversationId, ...(query.beforeId ? { id: { lt: query.beforeId } } : {}) },
    orderBy: { id: "desc" },
    take: query.limit + 1,
  });

  const hasMore = rows.length > query.limit;
  // Newest are fetched first, but the client displays oldest to newest.
  const items = rows.slice(0, query.limit).reverse().map(toMessageDto);
  return { items, hasMore };
}

export async function sendMessage(
  conversationId: number,
  user: AuthUser,
  input: { text: string; callId?: number },
) {
  const conversation = await loadParticipantConversation(conversationId, user.id);

  if (input.callId !== undefined) {
    const call = await prisma.call.findFirst({
      where: {
        id: input.callId,
        clientId: conversation.clientId,
        translatorId: conversation.translatorId,
      },
    });
    if (!call) {
      throw new HttpError(400, "The call does not belong to this conversation");
    }
  }

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: {
        conversationId,
        senderId: user.id,
        callId: input.callId ?? null,
        text: input.text,
      },
    });
    await tx.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: created.createdAt },
    });
    return created;
  });

  const dto = toMessageDto(message);
  const recipientId = user.id === conversation.clientId ? conversation.translatorId : conversation.clientId;
  emitToUser(recipientId, "message:new", dto);
  emitToUser(user.id, "message:new", dto);
  return dto;
}

export async function markConversationRead(conversationId: number, user: AuthUser) {
  const conversation = await loadParticipantConversation(conversationId, user.id);

  const readAt = new Date();
  const result = await prisma.message.updateMany({
    where: { conversationId, senderId: { not: user.id }, readAt: null },
    data: { readAt },
  });

  if (result.count > 0) {
    const otherId = user.id === conversation.clientId ? conversation.translatorId : conversation.clientId;
    emitToUser(otherId, "messages:read", { conversationId, readerId: user.id, readAt });
  }
  return { updated: result.count };
}
