import type { RequestHandler } from "express";
import type { Role } from "../../generated/prisma/enums.js";
import { authenticateToken, type AuthUser } from "../lib/authenticate.js";
import { HttpError } from "../lib/http-error.js";

export type { AuthUser };

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw new HttpError(401, "Authentication required");
  }

  req.user = await authenticateToken(header.slice("Bearer ".length).trim());
  next();
};

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new HttpError(403, "Insufficient permissions");
    }
    next();
  };
}
