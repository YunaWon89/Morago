import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../../middleware/auth.js";

export async function createReview(
  callId: number,
  user: AuthUser,
  input: { rating: number; comment?: string },
) {
  const call = await prisma.call.findUnique({ where: { id: callId }, include: { review: true } });
  // Only the client of the call can rate it; do not reveal other people's calls.
  if (!call || call.clientId !== user.id) {
    throw new HttpError(404, "Call not found");
  }
  if (call.status !== "ENDED" || !call.durationSec || call.durationSec <= 0) {
    throw new HttpError(409, "Only calls that took place can be rated");
  }
  if (call.review) {
    throw new HttpError(409, "The call has already been rated");
  }

  return prisma.$transaction(async (tx) => {
    const review = await tx.review.create({
      data: {
        callId,
        authorId: user.id,
        translatorId: call.translatorId,
        rating: input.rating,
        comment: input.comment || null,
      },
    });

    // Keep the translator's average rating up to date.
    const stats = await tx.review.aggregate({
      where: { translatorId: call.translatorId },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await tx.translatorProfile.update({
      where: { userId: call.translatorId },
      data: {
        ratingAvg: Math.round((stats._avg.rating ?? 0) * 100) / 100,
        reviewsCount: stats._count._all,
      },
    });

    return {
      id: review.id,
      callId: review.callId,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
    };
  });
}

export async function listTranslatorReviews(
  translatorId: number,
  query: { page: number; limit: number },
) {
  const translator = await prisma.translatorProfile.findFirst({
    where: { userId: translatorId, verificationStatus: "APPROVED", user: { status: "ACTIVE" } },
    select: { ratingAvg: true, reviewsCount: true },
  });
  if (!translator) {
    throw new HttpError(404, "Translator not found");
  }

  const where = { translatorId };
  const rows = await prisma.review.findMany({
    where,
    orderBy: { id: "desc" },
    skip: (query.page - 1) * query.limit,
    take: query.limit,
    include: { author: { select: { fullName: true } } },
  });

  return {
    ratingAvg: Number(translator.ratingAvg),
    total: translator.reviewsCount,
    page: query.page,
    limit: query.limit,
    totalPages: Math.ceil(translator.reviewsCount / query.limit),
    items: rows.map((row) => ({
      id: row.id,
      rating: row.rating,
      comment: row.comment,
      createdAt: row.createdAt,
      author: row.author.fullName,
    })),
  };
}
