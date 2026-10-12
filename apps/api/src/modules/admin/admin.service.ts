import type { Prisma } from "../../../generated/prisma/client.js";
import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";

const userListSelect = {
  id: true,
  phone: true,
  email: true,
  fullName: true,
  role: true,
  status: true,
  blockedAt: true,
  blockReason: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

function paginated<T>(items: T[], total: number, page: number, limit: number) {
  return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
}

export async function listUsers(query: {
  role?: "USER" | "TRANSLATOR" | "ADMIN";
  status?: "ACTIVE" | "BLOCKED";
  search?: string;
  page: number;
  limit: number;
}) {
  const where: Prisma.UserWhereInput = {
    ...(query.role ? { role: query.role } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { phone: { contains: query.search } },
            { email: { contains: query.search } },
            { fullName: { contains: query.search } },
          ],
        }
      : {}),
  };

  const [total, items] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: userListSelect,
      orderBy: { id: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  return paginated(items, total, query.page, query.limit);
}

export async function getUserDetails(id: number) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      ...userListSelect,
      phoneVerifiedAt: true,
      translatorProfile: {
        select: {
          verificationStatus: true,
          topikLevel: true,
          pricePerMinute: true,
          isOnline: true,
          ratingAvg: true,
          reviewsCount: true,
        },
      },
      wallet: { select: { balance: true, currency: true } },
    },
  });
  if (!user) {
    throw new HttpError(404, "User not found");
  }

  return {
    ...user,
    translatorProfile: user.translatorProfile
      ? {
          ...user.translatorProfile,
          pricePerMinute: Number(user.translatorProfile.pricePerMinute),
          ratingAvg: Number(user.translatorProfile.ratingAvg),
        }
      : null,
    wallet: user.wallet
      ? { balance: Number(user.wallet.balance), currency: user.wallet.currency }
      : null,
  };
}

export async function blockUser(adminId: number, id: number, reason: string) {
  if (id === adminId) {
    throw new HttpError(400, "You cannot block yourself");
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new HttpError(404, "User not found");
  }
  if (user.role === "ADMIN") {
    throw new HttpError(403, "Admins cannot be blocked");
  }
  if (user.status === "BLOCKED") {
    throw new HttpError(409, "User is already blocked");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: { status: "BLOCKED", blockedAt: new Date(), blockReason: reason },
    }),
    // A blocked translator must disappear from the online list immediately.
    prisma.translatorProfile.updateMany({ where: { userId: id }, data: { isOnline: false } }),
  ]);

  return getUserDetails(id);
}

export async function unblockUser(id: number) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new HttpError(404, "User not found");
  }
  if (user.status !== "BLOCKED") {
    throw new HttpError(409, "User is not blocked");
  }

  await prisma.user.update({
    where: { id },
    data: { status: "ACTIVE", blockedAt: null, blockReason: null },
  });

  return getUserDetails(id);
}

export async function listTranslatorsForAdmin(query: {
  status?: "REGISTERED" | "INTERVIEW_SCHEDULED" | "APPROVED" | "REJECTED";
  page: number;
  limit: number;
}) {
  const where: Prisma.TranslatorProfileWhereInput = {
    ...(query.status ? { verificationStatus: query.status } : {}),
  };

  const [total, rows] = await prisma.$transaction([
    prisma.translatorProfile.count({ where }),
    prisma.translatorProfile.findMany({
      where,
      orderBy: { user: { createdAt: "desc" } },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: {
        user: { select: { fullName: true, phone: true, email: true, status: true, createdAt: true } },
        _count: { select: { languages: true, themes: true } },
      },
    }),
  ]);

  const items = rows.map((row) => ({
    id: row.userId,
    fullName: row.user.fullName,
    phone: row.user.phone,
    email: row.user.email,
    userStatus: row.user.status,
    verificationStatus: row.verificationStatus,
    topikLevel: row.topikLevel,
    pricePerMinute: Number(row.pricePerMinute),
    isOnline: row.isOnline,
    languagesCount: row._count.languages,
    themesCount: row._count.themes,
    registeredAt: row.user.createdAt,
  }));

  return paginated(items, total, query.page, query.limit);
}

export async function setVerificationStatus(
  id: number,
  status: "INTERVIEW_SCHEDULED" | "APPROVED" | "REJECTED",
) {
  const profile = await prisma.translatorProfile.findUnique({ where: { userId: id } });
  if (!profile) {
    throw new HttpError(404, "Translator not found");
  }

  await prisma.$transaction([
    prisma.translatorProfile.update({
      where: { userId: id },
      data: {
        verificationStatus: status,
        // Only approved translators can be online.
        ...(status !== "APPROVED" ? { isOnline: false } : {}),
      },
    }),
    prisma.notification.create({
      data: {
        userId: id,
        type: "SYSTEM",
        payload: { event: "VERIFICATION_STATUS_CHANGED", status },
      },
    }),
  ]);

  return { id, verificationStatus: status };
}
