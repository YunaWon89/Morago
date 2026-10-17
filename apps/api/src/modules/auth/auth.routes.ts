import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  sendCodeSchema,
  verifyResetCodeSchema,
  updateProfileSchema,
} from "./auth.schemas.js";
import {
  changePassword,
  getCurrentUser,
  loginUser,
  refreshToken,
  registerUser,
  requestPasswordReset,
  resetPassword,
  sendPasswordResetCode,
  sendRegistrationCode,
  verifyPasswordResetCode,
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

authRouter.post("/refresh", requireAuth, async (req, res) => {
  res.json(await refreshToken(req.user!.id));
});

authRouter.get("/me", requireAuth, async (req, res) => {
  res.json({ user: await getCurrentUser(req.user!.id) });
});

authRouter.post("/forgot-password", async (req, res) => {
  const { email } = forgotPasswordSchema.parse(req.body ?? {});
  res.json(await requestPasswordReset(email));
});

// Reset by SMS code: 1) ask for a code for a phone number, 2) check the code and get a one-time token,
// 3) send that token to /reset-password together with the new password.
authRouter.post("/forgot-password/phone", async (req, res) => {
  const { phone } = sendCodeSchema.parse(req.body ?? {});
  res.json(await sendPasswordResetCode(phone));
});

authRouter.post("/forgot-password/verify", async (req, res) => {
  const input = verifyResetCodeSchema.parse(req.body ?? {});
  res.json(await verifyPasswordResetCode(input));
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
