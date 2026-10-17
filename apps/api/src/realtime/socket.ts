import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { z } from "zod";
import { config } from "../config.js";
import { authenticateToken, type AuthUser } from "../lib/authenticate.js";
import { HttpError } from "../lib/http-error.js";
import { prisma } from "../lib/prisma.js";
import { noteHeartbeat } from "../modules/calls/calls.service.js";
import { emitToUser, setIo } from "./io.js";

const signalSchema = z.object({
  callId: z.number().int().positive(),
  type: z.enum(["offer", "answer", "ice"]),
  data: z.unknown(),
});

const heartbeatSchema = z.object({ callId: z.number().int().positive() });

// A translator who closes the last tab stays online for a short grace period (page reloads).
const OFFLINE_GRACE_MS = 30_000;
const offlineTimers = new Map<number, ReturnType<typeof setTimeout>>();

type SignalAck = (result: { ok: boolean; error?: string }) => void;

// Handles one "webrtc:signal" message. It never throws: the second argument comes from the client,
// so it may be anything (a string, an object), and only a real function is called.
export async function handleSignal(user: AuthUser, raw: unknown, maybeAck?: unknown) {
  // The second argument comes from the client, so TypeScript cannot vouch for it.
  const reply: SignalAck = (result) => {
    if (typeof maybeAck !== "function") {
      return;
    }
    try {
      maybeAck(result);
    } catch {
      // a broken callback must never crash the server
    }
  };
  try {
    const message = signalSchema.parse(raw);

    const call = await prisma.call.findUnique({
      where: { id: message.callId },
      select: { clientId: true, translatorId: true, status: true },
    });
    if (!call || (call.clientId !== user.id && call.translatorId !== user.id)) {
      throw new HttpError(404, "Call not found");
    }
    if (call.status !== "ACCEPTED" && call.status !== "ACTIVE") {
      throw new HttpError(409, "The call is not in progress");
    }

    const otherId = call.clientId === user.id ? call.translatorId : call.clientId;
    emitToUser(otherId, "webrtc:signal", {
      callId: message.callId,
      type: message.type,
      data: message.data,
      from: user.id,
    });
    reply({ ok: true });
  } catch (error) {
    const text =
      error instanceof HttpError
        ? error.message
        : error instanceof z.ZodError
          ? "Invalid signal"
          : "Signal failed";
    reply({ ok: false, error: text });
  }
}

export function initSocket(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: config.isProduction ? config.clientOrigins : true },
  });

  // The client connects with: io(url, { auth: { token } })
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== "string" || token.length === 0) {
        next(new Error("Authentication required"));
        return;
      }
      socket.data.user = await authenticateToken(token);
      next();
    } catch (error) {
      next(new Error(error instanceof HttpError ? error.message : "Authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user as AuthUser;
    // Every tab of the same user joins the same room.
    socket.join(`user:${user.id}`);
    socket.emit("ready", { userId: user.id, role: user.role });

    const pending = offlineTimers.get(user.id);
    if (pending) {
      clearTimeout(pending);
      offlineTimers.delete(user.id);
    }

    socket.on("disconnect", async () => {
      if (user.role !== "TRANSLATOR") {
        return;
      }
      try {
        const room = `user:${user.id}`;
        if ((await io.in(room).fetchSockets()).length > 0) {
          return;
        }
        const timer = setTimeout(async () => {
          offlineTimers.delete(user.id);
          try {
            if ((await io.in(room).fetchSockets()).length === 0) {
              await prisma.translatorProfile.updateMany({
                where: { userId: user.id, isOnline: true },
                data: { isOnline: false },
              });
            }
          } catch (error) {
            console.error("failed to set translator offline", error);
          }
        }, OFFLINE_GRACE_MS);
        timer.unref();
        offlineTimers.set(user.id, timer);
      } catch (error) {
        console.error("disconnect handler failed", error);
      }
    });

    // WebRTC signaling: the server only relays offers, answers and ICE candidates
    // between the two participants of a call. Audio and video never pass through it.
    // Sent every few seconds by both sides of an open call (see endDeadActiveCalls).
    socket.on("call:heartbeat", (raw: unknown) => {
      const parsed = heartbeatSchema.safeParse(raw);
      if (parsed.success) noteHeartbeat(user.id, parsed.data.callId);
    });

    socket.on("webrtc:signal", (raw: unknown, maybeAck?: unknown) => {
      void handleSignal(user, raw, maybeAck);
    });
  });

  setIo(io);
  return io;
}
