import "dotenv/config";
import { defineConfig } from "prisma/config";

// The database address comes from DATABASE_URL (apps/api/.env locally, the hosting settings in production).
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url: process.env.DATABASE_URL ?? "mysql://root:root@127.0.0.1:3307/morago" },
});
