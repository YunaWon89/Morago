import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  sendCodeSchema,
  updateProfileSchema,
} from "./auth.schemas.js";
import {
  changePassword,
  getCurrentUser,
  loginUser,
  registerUser,
  requestPasswordReset,
  resetPassword,
  sendRegistrationCode,
  updateProfile,
} from "./auth.service.js";

export const authRouter = Router();

authRouter.post("/send-code", async (req, res) => {
  const { phone } = sendCodeSchema.parse(req.body ?? {});
  res.json(await sendRegistrationCode(phone));
});

authRouter.post("/register", async (req, res) => {
  const input = registerSchema.parse(req.body ?? {});
  res.status(201).json(await registerUser(input));
});

authRouter.post("/login", async (req, res) => {
  const input = loginSchema.parse(req.body ?? {});
  res.json(await loginUser(input));
});

authRouter.get("/me", requireAuth, async (req, res) => {
  res.json({ user: await getCurrentUser(req.user!.id) });
});

authRouter.post("/forgot-password", async (req, res) => {
  const { email } = forgotPasswordSchema.parse(req.body ?? {});
  res.json(await requestPasswordReset(email));
});

authRouter.post("/reset-password", async (req, res) => {
  const input = resetPasswordSchema.parse(req.body ?? {});
  res.json(await resetPassword(input));
});

authRouter.post("/change-password", requireAuth, async (req, res) => {
  const input = changePasswordSchema.parse(req.body ?? {});
  res.json(await changePassword(req.user!.id, input));
});

authRouter.patch("/profile", requireAuth, async (req, res) => {
  const input = updateProfileSchema.parse(req.body ?? {});
  res.json({ user: await updateProfile(req.user!.id, input) });
});
