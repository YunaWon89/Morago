import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { requireAuth } from "../../middleware/auth.js";

export const accountRouter = Router();

const deleteSchema = z.object({ password: z.string().min(1, "Enter your password") });

// Delete my account. Calls and payments must stay in the history, so the account is
// closed (blocked, contact data freed) instead of being removed from the database.
accountRouter.delete("/me", requireAuth, async (req, res) => {
  const { password } = deleteSchema.parse(req.body ?? {});
  const userId = req.user!.id;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(404, "User not found");
  if (user.role === "ADMIN") throw new HttpError(403, "Administrator accounts cannot be deleted here");
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(400, "Wrong password");
  }

  const active = await prisma.call.count({
    where: {
      status: { in: ["REQUESTED", "ACCEPTED", "ACTIVE"] },
      OR: [{ clientId: userId }, { translator: { userId } }],
    },
  });
  if (active > 0) throw new HttpError(409, "Finish your current call first");

  await prisma.$transaction([
    prisma.translatorProfile.updateMany({ where: { userId }, data: { isOnline: false } }),
    prisma.user.update({
      where: { id: userId },
      data: {
        status: "BLOCKED",
        blockedAt: new Date(),
        blockReason: "Account deleted by the user",
        phone: `x${userId}_${user.phone}`.slice(0, 20),
        email: null,
        fullName: "Deleted user",
        avatarFileId: null,
      },
    }),
  ]);

  res.json({ ok: true });
});
