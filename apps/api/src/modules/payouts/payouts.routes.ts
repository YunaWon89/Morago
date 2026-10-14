import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { createPayoutSchema, listPayoutsQuerySchema } from "./payouts.schemas.js";
import { createPayout, listOwnPayouts } from "./payouts.service.js";

export const payoutsRouter = Router();

payoutsRouter.use(requireAuth, requireRole("TRANSLATOR"));

payoutsRouter.post("/", async (req, res) => {
  const input = createPayoutSchema.parse(req.body ?? {});
  res.status(201).json({ payout: await createPayout(req.user!.id, input) });
});

payoutsRouter.get("/", async (req, res) => {
  const { page, limit } = listPayoutsQuerySchema.parse(req.query);
  res.json(await listOwnPayouts(req.user!.id, { page, limit }));
});
