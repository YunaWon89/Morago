import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import jwt from "jsonwebtoken";
import { startTestServer } from "../helpers/server.js";

// This test needs a real MySQL database (a race cannot be shown with mocks).
// When the database is not running, the test is skipped.

let server: Awaited<ReturnType<typeof startTestServer>>;
let prisma: typeof import("../../src/lib/prisma.js").prisma;
let config: typeof import("../../src/config.js").config;
let dbAvailable = false;
let userId = 0;

const TEST_NAME = "Topup race test";

// Removes test users together with their wallets and transactions
// (a wallet with transactions cannot be deleted by cascade).
async function removeTestUsers() {
  const users = await prisma.user.findMany({ where: { fullName: TEST_NAME }, select: { id: true } });
  const ids = users.map((user) => user.id);
  if (ids.length === 0) {
    return;
  }
  await prisma.transaction.deleteMany({ where: { wallet: { userId: { in: ids } } } });
  await prisma.wallet.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

before(async () => {
  server = await startTestServer();
  ({ prisma } = await import("../../src/lib/prisma.js"));
  ({ config } = await import("../../src/config.js"));
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbAvailable = true;
  } catch {
    return;
  }

  await removeTestUsers(); // leftovers of an earlier failed run

  const user = await prisma.user.create({
    data: {
      phone: `+8210${Date.now().toString().slice(-8)}`,
      passwordHash: "not-a-real-hash",
      fullName: TEST_NAME,
      role: "USER",
      wallet: { create: {} },
    },
    include: { wallet: true },
  });
  userId = user.id;

  // The user already has two pending requests: only one more is allowed.
  await prisma.transaction.createMany({
    data: [1, 2].map(() => ({
      walletId: user.wallet!.id,
      type: "TOPUP" as const,
      amount: 10000,
      status: "PENDING" as const,
      providerRef: "seed",
    })),
  });
});

after(async () => {
  try {
    if (dbAvailable) {
      await removeTestUsers();
    }
  } finally {
    await prisma?.$disconnect();
    await server.close();
  }
});

test("parallel top-up requests cannot go over the limit of 3", async (t) => {
  if (!dbAvailable) {
    t.skip("database is not available");
    return;
  }

  const token = jwt.sign({ role: "USER" }, config.jwtSecret, { subject: String(userId), expiresIn: 600 });
  const send = () =>
    server.request("/api/wallet/topups", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ amount: 10000, senderName: "Race Test" }),
    });

  const responses = await Promise.all(Array.from({ length: 10 }, send));
  const statuses = responses.map((response) => response.status).sort();

  assert.equal(statuses.filter((status) => status === 201).length, 1, `statuses: ${statuses.join(",")}`);
  assert.equal(statuses.filter((status) => status === 409).length, 9, `statuses: ${statuses.join(",")}`);

  const pending = await prisma.transaction.count({
    where: { wallet: { userId }, type: "TOPUP", status: "PENDING" },
  });
  assert.equal(pending, 3);
});
