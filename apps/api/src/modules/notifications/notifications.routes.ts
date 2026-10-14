import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireAuth } from "../../middleware/auth.js";

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

notificationsRouter.get("/", async (req, res) => {
  const { page, limit } = querySchema.parse(req.query);
  const where = { userId: req.user!.id };

  const [total, unreadCount, rows] = await prisma.$transaction([
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { ...where, isRead: false } }),
    prisma.notification.findMany({
      where,
      orderBy: { id: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  res.json({
    items: rows.map((row) => ({
      id: row.id,
      type: row.type,
      payload: row.payload,
      isRead: row.isRead,
      createdAt: row.createdAt,
    })),
    unreadCount,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
});

notificationsRouter.post("/read-all", async (req, res) => {
  const result = await prisma.notification.updateMany({
    where: { userId: req.user!.id, isRead: false },
    data: { isRead: true },
  });
  res.json({ updated: result.count });
});
