import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { createReviewSchema, idParamSchema, listReviewsQuerySchema } from "./reviews.schemas.js";
import { createReview, listTranslatorReviews } from "./reviews.service.js";

export const reviewsRouter = Router();

reviewsRouter.post("/calls/:id/review", requireAuth, requireRole("USER"), async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const input = createReviewSchema.parse(req.body ?? {});
  res.status(201).json({ review: await createReview(id, req.user!, input) });
});

reviewsRouter.get("/translators/:id/reviews", requireAuth, async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const query = listReviewsQuerySchema.parse(req.query);
  res.json(await listTranslatorReviews(id, query));
});
