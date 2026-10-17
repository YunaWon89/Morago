import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../../config.js";
import { HttpError } from "../../lib/http-error.js";
import { sendEmail, sendSms } from "../../lib/notify.js";
import { prisma } from "../../lib/prisma.js";
import { normalizePhone } from "./auth.schemas.js";

const CODE_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
const BCRYPT_ROUNDS = 10;

// Used to keep login timing similar when the user does not exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", BCRYPT_ROUNDS);

function hashCode(phone: string, code: string): string {
  return crypto.createHmac("sha256", config.jwtSecret).update(`${phone}:${code}`).digest("hex");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

type UserRow = {
  id: number;
  phone: string;
  email: string | null;
  fullName: string;
  role: string;
  status: string;
  avatarFileId: number | null;
  createdAt: Date;
};

function publicUser(user: UserRow) {
  return {
    id: user.id,
    phone: user.phone,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    status: user.status,
    avatarFileId: user.avatarFileId,
    createdAt: user.createdAt,
  };
}

function signToken(user: { id: number; role: string }): string {
  return jwt.sign({ role: user.role }, config.jwtSecret, {
    subject: String(user.id),
    expiresIn: config.jwtExpiresInSeconds,
  });
}

// Gives a signed-in user a fresh token (the old one stays valid until it expires).
export async function refreshToken(userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new HttpError(401, "User not found");
  }
  if (user.status === "BLOCKED") {
    throw new HttpError(403, "Account is blocked");
  }
  return { token: signToken(user), expiresInSec: config.jwtExpiresInSeconds };
}

export async function sendRegistrationCode(phone: string) {
  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    throw new HttpError(409, "Phone number is already registered");
  }

  // A code created less than the cooldown ago still has most of its lifetime left.
  const recent = await prisma.verificationCode.findFirst({
    where: {
      phone,
      purpose: "REGISTRATION",
      usedAt: null,
      expiresAt: { gt: new Date(Date.now() + CODE_TTL_MS - RESEND_COOLDOWN_MS) },
    },
  });
  if (recent) {
    throw new HttpError(429, "Please wait a minute before requesting a new code");
  }

  const code = String(crypto.randomInt(100000, 1000000));

  await prisma.$transaction([
    prisma.verificationCode.deleteMany({ where: { phone, purpose: "REGISTRATION" } }),
    prisma.verificationCode.create({
      data: {
        phone,
        purpose: "REGISTRATION",
        codeHash: hashCode(phone, code),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    }),
  ]);

  await sendSms(phone, `MORAGO verification code: ${code}`);

  return {
    message: "Verification code sent",
    expiresInSec: CODE_TTL_MS / 1000,
    // Convenience for local testing only; never returned in production.
    ...(config.isProduction ? {} : { devCode: code }),
  };
}

export async function registerUser(input: {
  phone: string;
  code: string;
  password: string;
  fullName: string;
  email: string;
  role: "USER" | "TRANSLATOR";
}) {
  const record = await prisma.verificationCode.findFirst({
    where: {
      phone: input.phone,
      purpose: "REGISTRATION",
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { id: "desc" },
  });

  if (!record) {
    throw new HttpError(400, "Invalid or expired code");
  }
  if (record.attempts >= MAX_CODE_ATTEMPTS) {
    throw new HttpError(429, "Too many attempts, request a new code");
  }
  if (!safeEqual(record.codeHash, hashCode(input.phone, input.code))) {
    await prisma.verificationCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    throw new HttpError(400, "Invalid or expired code");
  }

  const conflict = await prisma.user.findFirst({
    where: { OR: [{ phone: input.phone }, { email: input.email }] },
    select: { phone: true },
  });
  if (conflict) {
    throw new HttpError(
      409,
      conflict.phone === input.phone
        ? "Phone number is already registered"
        : "Email is already registered",
    );
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  const user = await prisma.$transaction(async (tx) => {
    await tx.verificationCode.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    return tx.user.create({
      data: {
        phone: input.phone,
        email: input.email,
        passwordHash,
        fullName: input.fullName,
        role: input.role,
        phoneVerifiedAt: new Date(),
        wallet: { create: {} },
        ...(input.role === "TRANSLATOR" ? { translatorProfile: { create: {} } } : {}),
      },
    });
  });

  return { token: signToken(user), user: publicUser(user) };
}

export async function loginUser(input: { login: string; password: string }) {
  const isEmail = input.login.includes("@");
  const user = await prisma.user.findUnique({
    where: isEmail
      ? { email: input.login.toLowerCase() }
      : { phone: normalizePhone(input.login) },
  });

  const passwordOk = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !passwordOk) {
    throw new HttpError(401, "Invalid credentials");
  }
  if (user.status === "BLOCKED") {
    throw new HttpError(403, "Account is blocked");
  }

  return { token: signToken(user), user: publicUser(user) };
}

export async function getCurrentUser(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { translatorProfile: true },
  });
  if (!user) {
    throw new HttpError(404, "User not found");
  }
  return { ...publicUser(user), translatorProfile: user.translatorProfile };
}

export async function requestPasswordReset(email: string) {
  const message = "If this email is registered, a reset link has been sent";

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status === "BLOCKED") {
    return { message };
  }

  const token = crypto.randomBytes(32).toString("hex");

  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    }),
  ]);

  const link = `${config.clientUrl}/reset-password?token=${token}`;
  await sendEmail(email, "MORAGO password reset", `Reset your password: ${link}`);

  return {
    message,
    // Convenience for local testing only; never returned in production.
    ...(config.isProduction ? {} : { devResetLink: link }),
  };
}

export async function sendPasswordResetCode(phone: string) {
  const message = "If this number is registered, a code has been sent";
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user || user.status === "BLOCKED") {
    return { message, expiresInSec: CODE_TTL_MS / 1000 };
  }

  const recent = await prisma.verificationCode.findFirst({
    where: {
      phone,
      purpose: "PASSWORD_RESET",
      usedAt: null,
      expiresAt: { gt: new Date(Date.now() + CODE_TTL_MS - RESEND_COOLDOWN_MS) },
    },
  });
  if (recent) {
    throw new HttpError(429, "Please wait a minute before requesting a new code");
  }

  const code = String(crypto.randomInt(100000, 1000000));
  await prisma.$transaction([
    prisma.verificationCode.deleteMany({ where: { phone, purpose: "PASSWORD_RESET" } }),
    prisma.verificationCode.create({
      data: {
        phone,
        purpose: "PASSWORD_RESET",
        codeHash: hashCode(phone, code),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    }),
  ]);
  await sendSms(phone, `MORAGO password reset code: ${code}`);

  return {
    message,
    expiresInSec: CODE_TTL_MS / 1000,
    // Convenience for local testing only; never returned in production.
    ...(config.isProduction ? {} : { devCode: code }),
  };
}

export async function verifyPasswordResetCode(input: { phone: string; code: string }) {
  const record = await prisma.verificationCode.findFirst({
    where: {
      phone: input.phone,
      purpose: "PASSWORD_RESET",
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { id: "desc" },
  });
  if (!record) {
    throw new HttpError(400, "Invalid or expired code");
  }
  if (record.attempts >= MAX_CODE_ATTEMPTS) {
    throw new HttpError(429, "Too many attempts, request a new code");
  }
  if (!safeEqual(record.codeHash, hashCode(input.phone, input.code))) {
    await prisma.verificationCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    throw new HttpError(400, "Invalid or expired code");
  }

  const user = await prisma.user.findUnique({ where: { phone: input.phone } });
  if (!user || user.status !== "ACTIVE") {
    throw new HttpError(400, "Invalid or expired code");
  }

  const token = crypto.randomBytes(32).toString("hex");
  await prisma.$transaction([
    prisma.verificationCode.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    }),
  ]);

  return { token };
}

export async function resetPassword(input: { token: string; password: string }) {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(input.token) },
  });

  if (!record || record.usedAt || record.expiresAt <= new Date()) {
    throw new HttpError(400, "Invalid or expired reset token");
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return { message: "Password has been reset" };
}

export async function changePassword(
  userId: number,
  input: { currentPassword: string; newPassword: string },
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new HttpError(404, "User not found");
  }
  if (!(await bcrypt.compare(input.currentPassword, user.passwordHash))) {
    throw new HttpError(400, "Current password is incorrect");
  }

  const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  return { message: "Password has been changed" };
}

export async function updateProfile(userId: number, input: { fullName: string }) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { fullName: input.fullName },
  });
  return publicUser(user);
}
