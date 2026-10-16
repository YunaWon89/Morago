import "./env.js";
import type { AddressInfo } from "node:net";
import http from "node:http";

// Starts the real Express app on a random free port and returns helpers for requests.
export async function startTestServer() {
  const { app } = await import("../../src/app.js");
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;

  return {
    base,
    request: (path: string, init?: RequestInit) => fetch(base + path, init),
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
