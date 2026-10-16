import "dotenv/config";
import { defineConfig } from "prisma/config";

// The database address comes from DATABASE_URL (apps/api/.env locally, the hosting settings in production).
// The fallback lets "prisma generate" run in CI and Docker builds, where there is no .env.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: { url: process.env.DATABASE_URL ?? "mysql://root:root@127.0.0.1:3307/morago" },
});
