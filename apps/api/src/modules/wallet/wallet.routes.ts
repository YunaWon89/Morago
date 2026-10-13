import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { requireAuth } from "../../middleware/auth.js";

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
