import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { config } from "../../config.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

export const walletRouter = Router();

walletRouter.use(requireAuth);

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Balance and transaction history of the current user.
walletRouter.get("/", async (req, res) => {
  const { page, limit } = querySchema.parse(req.query);

  const wallet = await prisma.wallet.findUnique({ where: { userId: req.user!.id } });
  if (!wallet) {
    throw new HttpError(404, "Wallet not found");
  }

  const where = { walletId: wallet.id };
  const [total, rows] = await prisma.$transaction([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      orderBy: { id: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  res.json({
    balance: Number(wallet.balance),
    currency: wallet.currency,
    transactions: {
      items: rows.map((row) => ({
        id: row.id,
        type: row.type,
        amount: Number(row.amount),
        status: row.status,
        callId: row.callId,
        createdAt: row.createdAt,
      })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// Bank details shown to a user who wants to top up the balance by a bank transfer.
walletRouter.get("/topup-info", (_req, res) => {
  res.json({
    bankName: config.topupBankName,
    accountNumber: config.topupAccountNumber,
    minAmount: config.topupMinAmount,
  });
});

const topupSchema = z.object({
  amount: z.number().int().min(config.topupMinAmount).max(100_000_000),
  senderName: z.string().trim().min(2).max(100),
});

// The user says "I have sent this amount"; an admin confirms it, then the balance grows.
walletRouter.post("/topups", requireRole("USER"), async (req, res) => {
  const { amount, senderName } = topupSchema.parse(req.body ?? {});

  const wallet = await prisma.wallet.findUnique({ where: { userId: req.user!.id } });
  if (!wallet) {
    throw new HttpError(404, "Wallet not found");
  }

  const pending = await prisma.transaction.count({
    where: { walletId: wallet.id, type: "TOPUP", status: "PENDING" },
  });
  if (pending >= 3) {
    throw new HttpError(409, "You already have pending top-up requests");
  }

  const created = await prisma.transaction.create({
    data: { walletId: wallet.id, type: "TOPUP", amount, status: "PENDING", providerRef: senderName },
  });
  res.status(201).json({
    topup: { id: created.id, amount, senderName, status: created.status, createdAt: created.createdAt },
  });
});
