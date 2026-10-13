import type { Server } from "socket.io";

let io: Server | null = null;

export function setIo(server: Server) {
  io = server;
}

// Sends an event to every open connection (browser tab) of a user.
// Does nothing when the socket server is not running, so HTTP code keeps working.
export function emitToUser(userId: number, event: string, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
}
