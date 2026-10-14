import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { listAllCalls } from "../calls/calls.service.js";
import {
  idParamSchema,
  listPayoutsQuerySchema,
  processPayoutSchema,
} from "../payouts/payouts.schemas.js";
import { listPayoutsForAdmin, processPayout } from "../payouts/payouts.service.js";

// Mounted inside the admin router, which already requires the ADMIN role.
export const adminFinanceRouter = Router();

const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const callsQuery = pageQuery.extend({
  status: z
    .enum(["REQUESTED", "ACCEPTED", "ACTIVE", "ENDED", "MISSED", "REJECTED", "FAILED"])
    .optional(),
  userId: z.coerce.number().int().positive().optional(),
});

adminFinanceRouter.get("/payouts", async (req, res) => {
  const query = listPayoutsQuerySchema.parse(req.query);
  res.json(await listPayoutsForAdmin(query));
});

adminFinanceRouter.patch("/payouts/:id", async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const { status } = processPayoutSchema.parse(req.body ?? {});
  res.json({ payout: await processPayout(req.user!.id, id, status) });
});

// Transaction journal of one user, used to check whether a payment was handled correctly.
adminFinanceRouter.get("/users/:id/transactions", async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const { page, limit } = pageQuery.parse(req.query);

  const wallet = await prisma.wallet.findUnique({ where: { userId: id } });
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
    userId: id,
    balance: Number(wallet.balance),
    currency: wallet.currency,
    items: rows.map((row) => ({
      id: row.id,
      type: row.type,
      amount: Number(row.amount),
      status: row.status,
      callId: row.callId,
      payoutRequestId: row.payoutRequestId,
      createdById: row.createdById,
      createdAt: row.createdAt,
    })),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
});

adminFinanceRouter.get("/calls", async (req, res) => {
  const query = callsQuery.parse(req.query);
  res.json(await listAllCalls(query));
});
