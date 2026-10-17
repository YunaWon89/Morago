import type { Prisma } from "../../../generated/prisma/client.js";
import { config } from "../../config.js";
import { HttpError } from "../../lib/http-error.js";
import { calculateCost, splitCharge } from "../../lib/money.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../../middleware/auth.js";
import { emitToUser } from "../../realtime/io.js";

// A request nobody answers within this time becomes MISSED.
const REQUEST_TIMEOUT_MS = 60 * 1000;
// An accepted call that never started within this time becomes FAILED.
const ACCEPTED_TIMEOUT_MS = 5 * 60 * 1000;

const OPEN_STATUSES = ["REQUESTED", "ACCEPTED", "ACTIVE"] as const;

const callInclude = {
  client: { select: { id: true, fullName: true, avatarFileId: true } },
  translator: {
    include: { user: { select: { id: true, fullName: true, avatarFileId: true } } },
  },
  language: { select: { id: true, code: true, name: true } },
  theme: { select: { id: true, name: true, nameKo: true } },
  review: { select: { rating: true, comment: true } },
} satisfies Prisma.CallInclude;

type CallRow = Prisma.CallGetPayload<{ include: typeof callInclude }>;

function toCallDto(call: CallRow) {
  return {
    id: call.id,
    type: call.type,
    status: call.status,
    pricePerMinute: Number(call.pricePerMinute),
    requestedAt: call.requestedAt,
    startedAt: call.startedAt,
    endedAt: call.endedAt,
    durationSec: call.durationSec,
    totalCost: call.totalCost === null ? null : Number(call.totalCost),
    client: call.client,
    translator: {
      id: call.translator.userId,
      fullName: call.translator.user.fullName,
      avatarFileId: call.translator.user.avatarFileId,
    },
    language: call.language,
    theme: call.theme,
    review: call.review,
  };
}

export async function expireStaleCalls() {
  const now = Date.now();
  const stale = await prisma.call.findMany({
    where: {
      OR: [
        { status: "REQUESTED", requestedAt: { lt: new Date(now - REQUEST_TIMEOUT_MS) } },
        { status: "ACCEPTED", requestedAt: { lt: new Date(now - ACCEPTED_TIMEOUT_MS) } },
      ],
    },
    select: { id: true, status: true },
  });

  for (const item of stale) {
    const result = await prisma.call.updateMany({
      where: { id: item.id, status: item.status },
      data: { status: item.status === "REQUESTED" ? "MISSED" : "FAILED", endedAt: new Date() },
    });
    if (result.count > 0) {
      await reload(item.id);
    }
  }
}

async function loadCall(callId: number, user: AuthUser): Promise<CallRow> {
  const call = await prisma.call.findUnique({ where: { id: callId }, include: callInclude });
  const isParticipant = call && (call.clientId === user.id || call.translatorId === user.id);
  // Do not reveal that someone else's call exists.
  if (!call || (!isParticipant && user.role !== "ADMIN")) {
    throw new HttpError(404, "Call not found");
  }
  return call;
}

// Loads the call after a change and tells both participants about it in real time.
async function reload(callId: number, options: { incoming?: boolean } = {}) {
  const call = await prisma.call.findUniqueOrThrow({ where: { id: callId }, include: callInclude });
  const dto = toCallDto(call);

  emitToUser(dto.client.id, "call:updated", dto);
  emitToUser(dto.translator.id, "call:updated", dto);
  if (options.incoming) {
    emitToUser(dto.translator.id, "call:incoming", dto);
  }
  return dto;
}

export async function createCall(
  clientId: number,
  input: { translatorId: number; languageId: number; themeId: number; type: "AUDIO" | "VIDEO" },
) {
  await expireStaleCalls();

  const translator = await prisma.translatorProfile.findFirst({
    where: {
      userId: input.translatorId,
      verificationStatus: "APPROVED",
      user: { status: "ACTIVE" },
    },
    include: {
      languages: { where: { languageId: input.languageId } },
      themes: { where: { themeId: input.themeId } },
    },
  });
  if (!translator) {
    throw new HttpError(404, "Translator not found");
  }
  if (!translator.isOnline) {
    throw new HttpError(409, "Translator is offline");
  }
  if (translator.languages.length === 0) {
    throw new HttpError(400, "Translator does not speak the selected language");
  }
  if (translator.themes.length === 0) {
    throw new HttpError(400, "Translator does not work with the selected theme");
  }

  const price = Number(translator.pricePerMinute);
  const wallet = await prisma.wallet.findUnique({ where: { userId: clientId } });
  if (!wallet || Number(wallet.balance) < price) {
    throw new HttpError(402, "Insufficient balance: at least one minute must be covered");
  }

  const [clientBusy, translatorBusy] = await Promise.all([
    prisma.call.findFirst({ where: { clientId, status: { in: [...OPEN_STATUSES] } } }),
    prisma.call.findFirst({
      where: { translatorId: input.translatorId, status: { in: [...OPEN_STATUSES] } },
    }),
  ]);
  if (clientBusy) {
    throw new HttpError(409, "You already have a call in progress");
  }
  if (translatorBusy) {
    throw new HttpError(409, "Translator is busy");
  }

  const call = await prisma.call.create({
    data: {
      clientId,
      translatorId: input.translatorId,
      languageId: input.languageId,
      themeId: input.themeId,
      type: input.type,
      // Snapshot: a later price change must not affect this call.
      pricePerMinute: price,
    },
  });

  // The pair gets a shared chat so they can write to each other before and after the call.
  await prisma.conversation.upsert({
    where: { clientId_translatorId: { clientId, translatorId: input.translatorId } },
    update: {},
    create: { clientId, translatorId: input.translatorId },
  });

  return reload(call.id, { incoming: true });
}

export async function listMyCalls(
  user: AuthUser,
  query: { status?: CallRow["status"]; from?: string; to?: string; page: number; limit: number },
) {
  const requestedAt: { gte?: Date; lt?: Date } = {};
  if (query.from) requestedAt.gte = new Date(`${query.from}T00:00:00+09:00`);
  if (query.to) requestedAt.lt = new Date(new Date(`${query.to}T00:00:00+09:00`).getTime() + 24 * 3600 * 1000);

  const where: Prisma.CallWhereInput = {
    ...(user.role === "TRANSLATOR" ? { translatorId: user.id } : { clientId: user.id }),
    ...(query.status ? { status: query.status } : {}),
    ...(query.from || query.to ? { requestedAt } : {}),
  };

  const [total, rows] = await prisma.$transaction([
    prisma.call.count({ where }),
    prisma.call.findMany({
      where,
      include: callInclude,
      orderBy: { id: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  return {
    items: rows.map(toCallDto),
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.ceil(total / query.limit),
  };
}

export async function getCall(callId: number, user: AuthUser) {
  await expireStaleCalls();
  return toCallDto(await loadCall(callId, user));
}

export async function acceptCall(callId: number, user: AuthUser) {
  await expireStaleCalls();
  const call = await loadCall(callId, user);
  if (call.translatorId !== user.id) {
    throw new HttpError(404, "Call not found");
  }

  const busy = await prisma.call.findFirst({
    where: { translatorId: user.id, status: { in: ["ACCEPTED", "ACTIVE"] }, id: { not: callId } },
  });
  if (busy) {
    throw new HttpError(409, "You already have a call in progress");
  }

  const result = await prisma.call.updateMany({
    where: { id: callId, status: "REQUESTED" },
    data: { status: "ACCEPTED" },
  });
  if (result.count === 0) {
    throw new HttpError(409, "The call is no longer waiting for an answer");
  }
  return reload(callId);
}

export async function rejectCall(callId: number, user: AuthUser) {
  const call = await loadCall(callId, user);
  if (call.translatorId !== user.id) {
    throw new HttpError(404, "Call not found");
  }

  const result = await prisma.call.updateMany({
    where: { id: callId, status: "REQUESTED" },
    data: { status: "REJECTED", endedAt: new Date() },
  });
  if (result.count === 0) {
    throw new HttpError(409, "The call is no longer waiting for an answer");
  }
  return reload(callId);
}

// The client hangs up before anyone answered: counts as a missed call.
export async function cancelCall(callId: number, user: AuthUser) {
  const call = await loadCall(callId, user);
  if (call.clientId !== user.id) {
    throw new HttpError(404, "Call not found");
  }

  const result = await prisma.call.updateMany({
    where: { id: callId, status: "REQUESTED" },
    data: { status: "MISSED", endedAt: new Date() },
  });
  if (result.count === 0) {
    throw new HttpError(409, "The call can no longer be cancelled");
  }
  return reload(callId);
}

// Called when the media connection is established. Billing starts here.
export async function startCall(callId: number, user: AuthUser) {
  const call = await loadCall(callId, user);
  if (call.status === "ACTIVE") {
    return toCallDto(call);
  }

  const result = await prisma.call.updateMany({
    where: { id: callId, status: "ACCEPTED" },
    data: { status: "ACTIVE", startedAt: new Date() },
  });
  if (result.count === 0) {
    // The other participant may have confirmed the start a moment earlier.
    const latest = await loadCall(callId, user);
    if (latest.status === "ACTIVE") {
      return toCallDto(latest);
    }
    throw new HttpError(409, `The call cannot be started in status ${latest.status}`);
  }
  return reload(callId);
}

// ---------- connection liveness ----------
// Both browsers send a heartbeat every few seconds while a call is open. If one side goes silent
// (closed tab, lost network), the call is ended and charged only up to the last sign of life.
export const HEARTBEAT_TIMEOUT_MS = 30_000;
const lastSeen = new Map<string, number>();
const bootAt = Date.now();

export function noteHeartbeat(userId: number, callId: number, now = Date.now()) {
  lastSeen.set(`${callId}:${userId}`, now);
}

type ActiveCallInfo = { id: number; clientId: number; translatorId: number; startedAt: Date };

// Pure decision: which active calls lost a participant, and when to stop charging.
export function findDeadCalls(
  calls: ActiveCallInfo[],
  seen: Map<string, number>,
  now: number,
  startedFrom: number,
  timeoutMs = HEARTBEAT_TIMEOUT_MS,
) {
  const dead: { id: number; endedAt: Date }[] = [];
  for (const call of calls) {
    // Before the first heartbeat (or after a server restart) the call counts as alive since its start/boot.
    const base = Math.max(call.startedAt.getTime(), startedFrom);
    const client = seen.get(`${call.id}:${call.clientId}`) ?? base;
    const translator = seen.get(`${call.id}:${call.translatorId}`) ?? base;
    const oldest = Math.min(client, translator);
    if (now - oldest > timeoutMs) {
      dead.push({ id: call.id, endedAt: new Date(Math.max(call.startedAt.getTime(), oldest)) });
    }
  }
  return dead;
}

export async function endDeadActiveCalls() {
  const active = await prisma.call.findMany({
    where: { status: "ACTIVE", startedAt: { not: null } },
    select: { id: true, clientId: true, translatorId: true, startedAt: true, pricePerMinute: true },
  });
  const calls = active.map((call) => ({ ...call, startedAt: call.startedAt as Date }));

  for (const dead of findDeadCalls(calls, lastSeen, Date.now(), bootAt)) {
    const call = calls.find((item) => item.id === dead.id)!;
    await finishActiveCall(call, dead.endedAt);
  }

  // A call never lasts longer than CALL_MAX_MINUTES: it is ended and charged up to that limit.
  const maxMs = config.callMaxMinutes * 60 * 1000;
  for (const call of calls) {
    if (Date.now() - call.startedAt.getTime() > maxMs) {
      await finishActiveCall(call, new Date(call.startedAt.getTime() + maxMs));
    }
  }

  const open = new Set(calls.map((call) => String(call.id)));
  for (const key of lastSeen.keys()) {
    if (!open.has(key.split(":")[0]!)) lastSeen.delete(key);
  }
}

export async function endCall(callId: number, user: AuthUser) {
  const call = await loadCall(callId, user);

  if (call.status === "ENDED") {
    return toCallDto(call);
  }

  // Accepted but never started: nothing to charge.
  if (call.status === "ACCEPTED") {
    await prisma.call.updateMany({
      where: { id: callId, status: "ACCEPTED" },
      data: { status: "ENDED", endedAt: new Date(), durationSec: 0, totalCost: 0 },
    });
    return reload(callId);
  }

  if (call.status !== "ACTIVE" || !call.startedAt) {
    throw new HttpError(409, `The call cannot be ended in status ${call.status}`);
  }

  // If the other side has been silent (closed tab, lost network), the silence is not charged:
  // the call is counted only up to the last sign of life of the other side.
  const otherId = user.id === call.clientId ? call.translatorId : call.clientId;
  const endedAt = chargeUntil(Date.now(), lastSeen.get(`${callId}:${otherId}`), call.startedAt);
  return finishActiveCall(call, endedAt);
}

// A heartbeat comes every 5 seconds, so more than 8 seconds of silence means at least one was missed.
export const SILENCE_LIMIT_MS = 8_000;

export function chargeUntil(now: number, otherSeen: number | undefined, startedAt: Date, limitMs = SILENCE_LIMIT_MS) {
  if (otherSeen !== undefined && now - otherSeen > limitMs) {
    return new Date(Math.max(startedAt.getTime(), otherSeen));
  }
  return new Date(now);
}

// Ends an ACTIVE call and charges for the time up to endedAt.
async function finishActiveCall(
  call: { id: number; clientId: number; translatorId: number; startedAt: Date | null; pricePerMinute: unknown },
  endedAt: Date,
) {
  const callId = call.id;
  if (!call.startedAt) {
    return reload(callId);
  }
  const durationSec = Math.max(0, Math.floor((endedAt.getTime() - call.startedAt.getTime()) / 1000));
  const price = Number(call.pricePerMinute);

  await prisma.$transaction(async (tx) => {
    // Whoever ends the call first wins; the second request changes nothing.
    const claimed = await tx.call.updateMany({
      where: { id: callId, status: "ACTIVE" },
      data: { status: "ENDED", endedAt, durationSec },
    });
    if (claimed.count === 0) {
      return;
    }

    const clientWallet = await tx.wallet.findUniqueOrThrow({ where: { userId: call.clientId } });
    const translatorWallet = await tx.wallet.findUniqueOrThrow({
      where: { userId: call.translatorId },
    });

    // The client is never charged more than the balance they have.
    const cost = calculateCost(price, durationSec);
    const charge = Math.min(cost, Number(clientWallet.balance));
    const { commission, earning } = splitCharge(charge, config.commissionPercent);

    if (charge > 0) {
      const debited = await tx.wallet.updateMany({
        where: { id: clientWallet.id, balance: { gte: charge } },
        data: { balance: { decrement: charge } },
      });
      if (debited.count === 0) {
        throw new HttpError(409, "Insufficient balance");
      }
      await tx.wallet.update({
        where: { id: translatorWallet.id },
        data: { balance: { increment: earning } },
      });

      await tx.transaction.createMany({
        data: [
          {
            walletId: clientWallet.id,
            callId,
            type: "CALL_CHARGE" as const,
            amount: -charge,
            status: "COMPLETED" as const,
          },
          {
            walletId: translatorWallet.id,
            callId,
            type: "CALL_EARNING" as const,
            amount: charge,
            status: "COMPLETED" as const,
          },
          ...(commission > 0
            ? [
                {
                  walletId: translatorWallet.id,
                  callId,
                  type: "COMMISSION" as const,
                  amount: -commission,
                  status: "COMPLETED" as const,
                },
              ]
            : []),
        ],
      });
    }

    await tx.call.update({ where: { id: callId }, data: { totalCost: charge } });
  });

  return reload(callId);
}

// All calls for the admin panel; can be narrowed down to one user.
export async function listAllCalls(query: {
  status?: CallRow["status"];
  userId?: number;
  page: number;
  limit: number;
}) {
  const where: Prisma.CallWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.userId
      ? { OR: [{ clientId: query.userId }, { translatorId: query.userId }] }
      : {}),
  };

  const [total, rows] = await prisma.$transaction([
    prisma.call.count({ where }),
    prisma.call.findMany({
      where,
      include: callInclude,
      orderBy: { id: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  return {
    items: rows.map(toCallDto),
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.ceil(total / query.limit),
  };
}
