import jwt from "jsonwebtoken";
import type { Role } from "../../generated/prisma/enums.js";
import { config } from "../config.js";
import { HttpError } from "./http-error.js";
import { prisma } from "./prisma.js";

export type AuthUser = { id: number; role: Role };

// Shared by HTTP requests and socket connections.
export async function authenticateToken(token: string): Promise<AuthUser> {
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

  return { id: user.id, role: user.role };
}
