import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { z } from "zod";
import { config } from "../config.js";
import { authenticateToken, type AuthUser } from "../lib/authenticate.js";
import { HttpError } from "../lib/http-error.js";
import { prisma } from "../lib/prisma.js";
import { emitToUser, setIo } from "./io.js";

const signalSchema = z.object({
  callId: z.number().int().positive(),
  type: z.enum(["offer", "answer", "ice"]),
  data: z.unknown(),
});

type SignalAck = (result: { ok: boolean; error?: string }) => void;

export function initSocket(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: config.isProduction ? config.clientUrl : true },
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

    // WebRTC signaling: the server only relays offers, answers and ICE candidates
    // between the two participants of a call. Audio and video never pass through it.
    socket.on("webrtc:signal", async (raw: unknown, ack?: SignalAck) => {
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
        ack?.({ ok: true });
      } catch (error) {
        const text =
          error instanceof HttpError
            ? error.message
            : error instanceof z.ZodError
              ? "Invalid signal"
              : "Signal failed";
        ack?.({ ok: false, error: text });
      }
    });
  });

  setIo(io);
  return io;
}
