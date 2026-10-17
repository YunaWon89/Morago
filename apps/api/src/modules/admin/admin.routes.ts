import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { adminCatalogRouter } from "./admin.catalog.routes.js";
import { adminFinanceRouter } from "./admin.finance.routes.js";
import {
  blockUserSchema,
  chargeSchema,
  idParamSchema,
  listTranslatorsQuerySchema,
  listUsersQuerySchema,
  verificationSchema,
} from "./admin.schemas.js";
import {
  blockUser,
  chargeWallet,
  getUserDetails,
  listTranslatorsForAdmin,
  listUsers,
  setVerificationStatus,
  unblockUser,
} from "./admin.service.js";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole("ADMIN"));
adminRouter.use(adminFinanceRouter);
adminRouter.use(adminCatalogRouter);

adminRouter.get("/users", async (req, res) => {
  const query = listUsersQuerySchema.parse(req.query);
  res.json(await listUsers(query));
});

adminRouter.get("/users/:id", async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json({ user: await getUserDetails(id) });
});

// Documents a user uploaded (for example a translator's certificates), to be checked before verification.
adminRouter.get("/users/:id/files", async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const files = await prisma.file.findMany({
    where: { ownerId: id, userAvatars: { none: {} }, categories: { none: {} }, themes: { none: {} } },
    orderBy: { id: "desc" },
    select: { id: true, mimeType: true, createdAt: true },
  });
  res.json({ files });
});

adminRouter.post("/users/:id/block", async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const { reason } = blockUserSchema.parse(req.body ?? {});
  res.json({ user: await blockUser(req.user!.id, id, reason) });
});

adminRouter.post("/users/:id/unblock", async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json({ user: await unblockUser(id) });
});

adminRouter.get("/translators", async (req, res) => {
  const query = listTranslatorsQuerySchema.parse(req.query);
  res.json(await listTranslatorsForAdmin(query));
});

adminRouter.patch("/translators/:id/verification", async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const { status } = verificationSchema.parse(req.body ?? {});
  res.json(await setVerificationStatus(id, status));
});

adminRouter.post("/users/:id/charge", async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const { amount } = chargeSchema.parse(req.body ?? {});
  res.json(await chargeWallet(req.user!.id, id, amount));
});
