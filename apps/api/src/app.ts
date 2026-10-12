import express from "express";
import cors from "cors";
import type { HealthResponse } from "@morago/contracts";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { authRouter } from "./modules/auth/auth.routes.js";

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

app.use("/api/auth", authRouter);

app.use(notFoundHandler);
app.use(errorHandler);
