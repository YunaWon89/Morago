import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import type { Role } from "../../generated/prisma/enums.js";
import { config } from "../config.js";
import { HttpError } from "../lib/http-error.js";
import { prisma } from "../lib/prisma.js";

export type AuthUser = { id: number; role: Role };

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

  const token = header.slice("Bearer ".length).trim();

  let payload: string | jwt.JwtPayload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new HttpError(401, "Invalid or expired token");
  }

  if (typeof payload === "string" || !payload.sub) {
    throw new HttpError(401, "Invalid token");
  }

  const user = await prisma.user.findUnique({
    where: { id: Number(payload.sub) },
    select: { id: true, role: true, status: true },
  });

  if (!user) {
    throw new HttpError(401, "User not found");
  }
  if (user.status === "BLOCKED") {
    throw new HttpError(403, "Account is blocked");
  }

  req.user = { id: user.id, role: user.role };
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
