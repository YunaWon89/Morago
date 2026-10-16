import morgan from "morgan";
import { config } from "../config.js";

// One line per request: method, url, status, time. Quiet while running tests.
export const requestLogger = morgan(config.isProduction ? "combined" : "dev", {
  skip: (req) => req.url === "/health",
});
