import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";

// A user may have at most this many top-up requests waiting for an admin.
export const MAX_PENDING_TOPUPS = 3;

// Creates a top-up request, but only if the user is below the limit.
//
// Checking the limit and creating the request must happen as one step. If they
// were separate, several parallel requests could all count "2 pending" before
// any of them created a row, and all of them would pass.
//
// So everything runs in one transaction, and the first statement locks the
// user's wallet row (SELECT ... FOR UPDATE). Parallel requests of the same user
// wait for the lock and run one after another; requests of other users are not
// blocked. READ COMMITTED makes the count see the rows that the previous
// request has just committed.
export async function createTopupRequest(userId: number, amount: number, senderName: string) {
  return prisma.$transaction(
    async (tx) => {
      const locked = await tx.$queryRaw<{ id: number }[]>`
        SELECT id FROM wallets WHERE user_id = ${userId} FOR UPDATE
      `;
      if (locked.length === 0) {
        throw new HttpError(404, "Wallet not found");
      }
      const walletId = Number(locked[0]!.id);

      const pending = await tx.transaction.count({
        where: { walletId, type: "TOPUP", status: "PENDING" },
      });
      if (pending >= MAX_PENDING_TOPUPS) {
        throw new HttpError(409, "You already have pending top-up requests");
      }

      return tx.transaction.create({
        data: { walletId, type: "TOPUP", amount, status: "PENDING", providerRef: senderName },
      });
    },
    { isolationLevel: "ReadCommitted", maxWait: 10_000, timeout: 10_000 },
  );
}
