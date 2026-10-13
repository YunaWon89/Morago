// Prints every real-time event a user receives.
// Usage (from apps/api):  node scripts/listen.mjs <JWT token> [server url]
import { io } from "socket.io-client";

const token = process.argv[2];
const url = process.argv[3] ?? "http://localhost:3000";

if (!token) {
  console.error("Usage: node scripts/listen.mjs <JWT token> [server url]");
  process.exit(1);
}

const socket = io(url, { auth: { token } });

socket.on("connect", () => console.log(`connected to ${url}`));
socket.on("connect_error", (error) => {
  console.error(`connection failed: ${error.message}`);
  process.exit(1);
});
socket.on("disconnect", (reason) => console.log(`disconnected: ${reason}`));
socket.onAny((event, payload) => {
  console.log(`\n[${new Date().toLocaleTimeString()}] ${event}`);
  console.log(JSON.stringify(payload, null, 2));
});
