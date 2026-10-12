import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma.js";

// Creates the first admin account. Credentials are read from apps/api/.env:
// ADMIN_PHONE, ADMIN_EMAIL, ADMIN_PASSWORD and optionally ADMIN_NAME.
async function main() {
  const phone = process.env.ADMIN_PHONE?.replace(/[\s\-().]/g, "");
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const fullName = process.env.ADMIN_NAME?.trim() || "Admin";

  if (!phone || !email || !password) {
    throw new Error("Set ADMIN_PHONE, ADMIN_EMAIL and ADMIN_PASSWORD in apps/api/.env");
  }
  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD must be at least 8 characters");
  }

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing && existing.role !== "ADMIN") {
    throw new Error("This phone number belongs to a non-admin user");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = existing
    ? await prisma.user.update({
        where: { phone },
        data: { email, passwordHash, fullName, status: "ACTIVE", blockedAt: null, blockReason: null },
      })
    : await prisma.user.create({
        data: {
          phone,
          email,
          passwordHash,
          fullName,
          role: "ADMIN",
          phoneVerifiedAt: new Date(),
          wallet: { create: {} },
        },
      });

  console.log(`Admin ready: id=${admin.id}, phone=${admin.phone}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
