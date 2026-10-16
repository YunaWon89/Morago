import { rateLimit } from "express-rate-limit";
import { config } from "../config.js";

// Slows down guessing of passwords and SMS codes: a limited number of tries per address.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.rateLimitAuthMax,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: { message: "Too many attempts, try again in a few minutes" } },
});
