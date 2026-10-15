import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The API runs on port 3000. Proxying keeps the browser on one origin,
// so no CORS settings are needed and Socket.io works over the same address.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:3000",
      "/socket.io": { target: "http://localhost:3000", ws: true },
    },
  },
});
