import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import {
  idParamSchema,
  listQuerySchema,
  onlineSchema,
  updateProfileSchema,
} from "./translators.schemas.js";
import {
  getOwnProfile,
  getTranslator,
  listTranslators,
  setOnline,
  updateOwnProfile,
} from "./translators.service.js";

export const translatorsRouter = Router();

translatorsRouter.use(requireAuth);

// Routes for the translator's own profile must be declared before "/:id".
translatorsRouter.get("/me", requireRole("TRANSLATOR"), async (req, res) => {
  res.json({ profile: await getOwnProfile(req.user!.id) });
});

translatorsRouter.patch("/me", requireRole("TRANSLATOR"), async (req, res) => {
  const input = updateProfileSchema.parse(req.body ?? {});
  res.json({ profile: await updateOwnProfile(req.user!.id, input) });
});

translatorsRouter.put("/me/online", requireRole("TRANSLATOR"), async (req, res) => {
  const { isOnline } = onlineSchema.parse(req.body ?? {});
  res.json({ profile: await setOnline(req.user!.id, isOnline) });
});

translatorsRouter.get("/", async (req, res) => {
  const query = listQuerySchema.parse(req.query);
  res.json(await listTranslators(query));
});

translatorsRouter.get("/:id", async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json({ translator: await getTranslator(id) });
});
