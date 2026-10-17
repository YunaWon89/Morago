import http from "node:http";
import { app } from "./app.js";
import { prisma } from "./lib/prisma.js";
import { config } from "./config.js";
import { endDeadActiveCalls, expireStaleCalls } from "./modules/calls/calls.service.js";
import { initSocket } from "./realtime/socket.js";

const server = http.createServer(app);
initSocket(server);

server.listen(config.port, () => {
  console.log(`API running on http://localhost:${config.port}`);
});

// After a restart nobody is connected, so nobody can still be shown as online.
prisma.translatorProfile
  .updateMany({ where: { isOnline: true }, data: { isOnline: false } })
  .catch((error) => console.error("failed to reset online flags", error));

// Unanswered call requests are closed automatically.
setInterval(() => {
  expireStaleCalls().catch((error) => console.error("expireStaleCalls failed", error));
}, 30_000).unref();

// A call whose participant disappeared (closed tab, lost network) is ended and charged up to the last heartbeat.
setInterval(() => {
  endDeadActiveCalls().catch((error) => console.error("endDeadActiveCalls failed", error));
}, 10_000).unref();
