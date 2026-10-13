import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { config } from "../config.js";
import { authenticateToken } from "../lib/authenticate.js";
import { HttpError } from "../lib/http-error.js";
import { setIo } from "./io.js";

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
    const user = socket.data.user as { id: number; role: string };
    // Every tab of the same user joins the same room.
    socket.join(`user:${user.id}`);
    socket.emit("ready", { userId: user.id, role: user.role });
  });

  setIo(io);
  return io;
}
