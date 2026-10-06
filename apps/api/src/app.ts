import express from "express";
import cors from "cors";
import type { HealthResponse } from "@morago/contracts";

export const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  const body: HealthResponse = { status: "ok" };
  res.json(body);
});