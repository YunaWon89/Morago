import type { Prisma } from "../../../generated/prisma/client.js";
import { config } from "../../config.js";
import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { emitToUser } from "../../realtime/io.js";

type PayoutRow = Prisma.PayoutRequestGetPayload<object>;

function toDto(payout: PayoutRow) {
  return {
    id: payout.id,
    translatorId: payout.translatorId,
    amount: Number(payout.amount),
    bankName: payout.bankName,
    accountNumber: payout.accountNumber,
    status: payout.status,
    createdAt: payout.createdAt,
    processedAt: payout.processedAt,
  };
}

function paginated<T>(items: T[], total: number, page: number, limit: number) {
  return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
}

// The requested amount is taken from the balance right away, so it cannot be spent twice.
export async function createPayout(
  userId: number,
  input: { amount: number; bankName: string; accountNumber: string },
) {
  if (input.amount < config.payoutMinAmount) {
    throw new HttpError(400, `The minimum withdrawal is ${config.payoutMinAmount} won`);
  }

  const payout = await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });

    const debited = await tx.wallet.updateMany({
      where: { id: wallet.id, balance: { gte: input.amount } },
      data: { balance: { decrement: input.amount } },
    });
    if (debited.count === 0) {
      throw new HttpError(402, "Insufficient balance");
    }

    const created = await tx.payoutRequest.create({
      data: {
        translatorId: userId,
        amount: input.amount,
        bankName: input.bankName,
        accountNumber: input.accountNumber,
      },
    });
    await tx.transaction.create({
      data: {
        walletId: wallet.id,
        payoutRequestId: created.id,
        type: "PAYOUT",
        amount: -input.amount,
        status: "PENDING",
      },
    });
    return created;
  });

  return toDto(payout);
}

export async function listOwnPayouts(userId: number, query: { page: number; limit: number }) {
  const where = { translatorId: userId };
  const [total, rows] = await prisma.$transaction([
    prisma.payoutRequest.count({ where }),
    prisma.payoutRequest.findMany({
      where,
      orderBy: { id: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);
  return paginated(rows.map(toDto), total, query.page, query.limit);
}

export async function listPayoutsForAdmin(query: {
  status?: "PENDING" | "APPROVED" | "REJECTED" | "PAID";
  page: number;
  limit: number;
}) {
  const where: Prisma.PayoutRequestWhereInput = query.status ? { status: query.status } : {};
  const [total, rows] = await prisma.$transaction([
    prisma.payoutRequest.count({ where }),
    prisma.payoutRequest.findMany({
      where,
      orderBy: { id: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: { translator: { include: { user: { select: { fullName: true, phone: true } } } } },
    }),
  ]);

  const items = rows.map((row) => ({
    ...toDto(row),
    translatorName: row.translator.user.fullName,
    translatorPhone: row.translator.user.phone,
  }));
  return paginated(items, total, query.page, query.limit);
}

// The admin pays the money out (PAID) or refuses (REJECTED, the money returns to the balance).
export async function processPayout(adminId: number, payoutId: number, status: "PAID" | "REJECTED") {
  const existing = await prisma.payoutRequest.findUnique({ where: { id: payoutId } });
  if (!existing) {
    throw new HttpError(404, "Payout request not found");
  }

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.payoutRequest.updateMany({
      where: { id: payoutId, status: "PENDING" },
      data: { status, processedById: adminId, processedAt: new Date() },
    });
    if (claimed.count === 0) {
      throw new HttpError(409, "The request has already been processed");
    }

    if (status === "PAID") {
      await tx.transaction.update({
        where: { payoutRequestId: payoutId },
        data: { status: "COMPLETED" },
      });
    } else {
      await tx.transaction.update({
        where: { payoutRequestId: payoutId },
        data: { status: "FAILED" },
      });
      const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId: existing.translatorId } });
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: existing.amount } },
      });
      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: "REFUND",
          amount: existing.amount,
          status: "COMPLETED",
          createdById: adminId,
        },
      });
    }

    await tx.notification.create({
      data: {
        userId: existing.translatorId,
        type: "SYSTEM",
        payload: { event: "PAYOUT_STATUS_CHANGED", payoutId, status },
      },
    });
  });

  const updated = await prisma.payoutRequest.findUniqueOrThrow({ where: { id: payoutId } });
  const dto = toDto(updated);
  emitToUser(updated.translatorId, "payout:updated", dto);
  emitToUser(updated.translatorId, "notification:new", {
    type: "SYSTEM",
    payload: { event: "PAYOUT_STATUS_CHANGED", payoutId, status },
  });
  return dto;
}
