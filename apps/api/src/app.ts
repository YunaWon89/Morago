import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import type { HealthResponse } from "@morago/contracts";
import { config } from "./config.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { adminRouter } from "./modules/admin/admin.routes.js";
import { callsRouter } from "./modules/calls/calls.routes.js";
import { conversationsRouter } from "./modules/conversations/conversations.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { payoutsRouter } from "./modules/payouts/payouts.routes.js";
import { referenceRouter } from "./modules/reference/reference.routes.js";
import { reviewsRouter } from "./modules/reviews/reviews.routes.js";
import { translatorsRouter } from "./modules/translators/translators.routes.js";
import { walletRouter } from "./modules/wallet/wallet.routes.js";

export const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ name: "MORAGO API", health: "/health" });
});

app.get("/health", (_req, res) => {
  const body: HealthResponse = { status: "ok" };
  res.json(body);
});

// A page for trying calls and chat in two browser tabs. Never served in production.
if (!config.isProduction) {
  app.use("/test", express.static(fileURLToPath(new URL("../public", import.meta.url))));
}

app.use("/api/auth", authRouter);
app.use("/api", referenceRouter);
app.use("/api/translators", translatorsRouter);
app.use("/api", reviewsRouter);
app.use("/api/payouts", payoutsRouter);
app.use("/api/calls", callsRouter);
app.use("/api/conversations", conversationsRouter);
app.use("/api/wallet", walletRouter);
app.use("/api/admin", adminRouter);

app.use(notFoundHandler);
app.use(errorHandler);
