import type { Prisma } from "../../../generated/prisma/client.js";
import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";

const profileInclude = {
  user: { select: { id: true, fullName: true, avatarFileId: true } },
  languages: { include: { language: { select: { id: true, code: true, name: true } } } },
  themes: { include: { theme: { select: { id: true, name: true, nameKo: true } } } },
} satisfies Prisma.TranslatorProfileInclude;

type ProfileRow = Prisma.TranslatorProfileGetPayload<{ include: typeof profileInclude }>;

function toCard(profile: ProfileRow) {
  return {
    id: profile.userId,
    fullName: profile.user.fullName,
    avatarFileId: profile.user.avatarFileId,
    topikLevel: profile.topikLevel,
    pricePerMinute: Number(profile.pricePerMinute),
    isOnline: profile.isOnline,
    ratingAvg: Number(profile.ratingAvg),
    reviewsCount: profile.reviewsCount,
    languages: profile.languages.map((item) => item.language),
    themes: profile.themes.map((item) => ({
      id: item.theme.id,
      name: item.theme.name,
      nameKo: item.theme.nameKo,
      withCertificate: item.withCertificate,
    })),
  };
}

function toOwnProfile(profile: ProfileRow) {
  return {
    ...toCard(profile),
    verificationStatus: profile.verificationStatus,
    dateOfBirth: profile.dateOfBirth,
  };
}

export async function listTranslators(query: {
  languageId?: number;
  themeId?: number;
  online?: boolean;
  sort: "rating" | "price_asc" | "price_desc";
  page: number;
  limit: number;
}) {
  const where: Prisma.TranslatorProfileWhereInput = {
    verificationStatus: "APPROVED",
    user: { status: "ACTIVE" },
    ...(query.online !== undefined ? { isOnline: query.online } : {}),
    ...(query.languageId ? { languages: { some: { languageId: query.languageId } } } : {}),
    ...(query.themeId ? { themes: { some: { themeId: query.themeId } } } : {}),
  };

  const orderBy: Prisma.TranslatorProfileOrderByWithRelationInput[] =
    query.sort === "price_asc"
      ? [{ pricePerMinute: "asc" }]
      : query.sort === "price_desc"
        ? [{ pricePerMinute: "desc" }]
        : [{ ratingAvg: "desc" }, { reviewsCount: "desc" }];

  const [total, rows] = await prisma.$transaction([
    prisma.translatorProfile.count({ where }),
    prisma.translatorProfile.findMany({
      where,
      orderBy: [...orderBy, { userId: "asc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: profileInclude,
    }),
  ]);

  return {
    items: rows.map(toCard),
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.ceil(total / query.limit),
  };
}

export async function getTranslator(id: number) {
  const profile = await prisma.translatorProfile.findFirst({
    where: { userId: id, verificationStatus: "APPROVED", user: { status: "ACTIVE" } },
    include: profileInclude,
  });
  if (!profile) {
    throw new HttpError(404, "Translator not found");
  }
  return toCard(profile);
}

export async function getOwnProfile(userId: number) {
  const profile = await prisma.translatorProfile.findUnique({
    where: { userId },
    include: profileInclude,
  });
  if (!profile) {
    throw new HttpError(404, "Translator profile not found");
  }
  return toOwnProfile(profile);
}

export async function updateOwnProfile(
  userId: number,
  input: {
    dateOfBirth?: string | null;
    topikLevel?: number | null;
    pricePerMinute?: number;
    languageIds?: number[];
    themes?: { themeId: number; withCertificate: boolean }[];
  },
) {
  const languageIds = input.languageIds ? [...new Set(input.languageIds)] : undefined;
  const themes = input.themes
    ? [...new Map(input.themes.map((theme) => [theme.themeId, theme])).values()]
    : undefined;

  let dateOfBirth: Date | null | undefined;
  if (input.dateOfBirth !== undefined) {
    dateOfBirth = input.dateOfBirth === null ? null : new Date(`${input.dateOfBirth}T00:00:00.000Z`);
    if (dateOfBirth && dateOfBirth.getTime() >= Date.now()) {
      throw new HttpError(400, "Date of birth must be in the past");
    }
  }

  if (languageIds) {
    const found = await prisma.language.count({ where: { id: { in: languageIds } } });
    if (found !== languageIds.length) {
      throw new HttpError(400, "Unknown language id");
    }
  }
  if (themes) {
    const found = await prisma.theme.count({
      where: { id: { in: themes.map((theme) => theme.themeId) }, isActive: true },
    });
    if (found !== themes.length) {
      throw new HttpError(400, "Unknown or inactive theme id");
    }
  }

  const existing = await prisma.translatorProfile.findUnique({ where: { userId } });
  if (!existing) {
    throw new HttpError(404, "Translator profile not found");
  }

  await prisma.$transaction(async (tx) => {
    await tx.translatorProfile.update({
      where: { userId },
      data: {
        ...(dateOfBirth !== undefined ? { dateOfBirth } : {}),
        ...(input.topikLevel !== undefined ? { topikLevel: input.topikLevel } : {}),
        ...(input.pricePerMinute !== undefined ? { pricePerMinute: input.pricePerMinute } : {}),
      },
    });

    if (languageIds) {
      await tx.translatorLanguage.deleteMany({ where: { translatorId: userId } });
      await tx.translatorLanguage.createMany({
        data: languageIds.map((languageId) => ({ translatorId: userId, languageId })),
      });
    }

    if (themes) {
      await tx.translatorTheme.deleteMany({ where: { translatorId: userId } });
      await tx.translatorTheme.createMany({
        data: themes.map((theme) => ({
          translatorId: userId,
          themeId: theme.themeId,
          withCertificate: theme.withCertificate,
        })),
      });
    }

    // A translator whose profile became incomplete must not stay online.
    const fresh = await tx.translatorProfile.findUniqueOrThrow({
      where: { userId },
      include: { _count: { select: { languages: true, themes: true } } },
    });
    const incomplete =
      Number(fresh.pricePerMinute) <= 0 || fresh._count.languages === 0 || fresh._count.themes === 0;
    if (fresh.isOnline && incomplete) {
      await tx.translatorProfile.update({ where: { userId }, data: { isOnline: false } });
    }
  });

  return getOwnProfile(userId);
}

export async function setOnline(userId: number, isOnline: boolean) {
  const profile = await prisma.translatorProfile.findUnique({
    where: { userId },
    include: { _count: { select: { languages: true, themes: true } } },
  });
  if (!profile) {
    throw new HttpError(404, "Translator profile not found");
  }

  if (isOnline) {
    if (profile.verificationStatus !== "APPROVED") {
      throw new HttpError(403, "Your profile has not been approved yet");
    }
    if (Number(profile.pricePerMinute) <= 0) {
      throw new HttpError(400, "Set your price per minute first");
    }
    if (profile._count.languages === 0 || profile._count.themes === 0) {
      throw new HttpError(400, "Add at least one language and one theme first");
    }
  }

  await prisma.translatorProfile.update({ where: { userId }, data: { isOnline } });
  return getOwnProfile(userId);
}
