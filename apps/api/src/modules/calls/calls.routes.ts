import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { createCallSchema, idParamSchema, listCallsQuerySchema } from "./calls.schemas.js";
import {
  acceptCall,
  cancelCall,
  createCall,
  endCall,
  getCall,
  listMyCalls,
  rejectCall,
  startCall,
} from "./calls.service.js";

export const callsRouter = Router();

callsRouter.use(requireAuth);

callsRouter.post("/", requireRole("USER"), async (req, res) => {
  const input = createCallSchema.parse(req.body ?? {});
  res.status(201).json({ call: await createCall(req.user!.id, input) });
});

callsRouter.get("/", requireRole("USER", "TRANSLATOR"), async (req, res) => {
  const query = listCallsQuerySchema.parse(req.query);
  res.json(await listMyCalls(req.user!, query));
});

callsRouter.get("/:id", async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json({ call: await getCall(id, req.user!) });
});

callsRouter.post("/:id/accept", requireRole("TRANSLATOR"), async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json({ call: await acceptCall(id, req.user!) });
});

callsRouter.post("/:id/reject", requireRole("TRANSLATOR"), async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json({ call: await rejectCall(id, req.user!) });
});

callsRouter.post("/:id/cancel", requireRole("USER"), async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json({ call: await cancelCall(id, req.user!) });
});

callsRouter.post("/:id/start", requireRole("USER", "TRANSLATOR"), async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json({ call: await startCall(id, req.user!) });
});

callsRouter.post("/:id/end", requireRole("USER", "TRANSLATOR"), async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json({ call: await endCall(id, req.user!) });
});
