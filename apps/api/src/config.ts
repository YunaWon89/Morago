import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN_DAYS: z.coerce.number().int().positive().default(7),
  CLIENT_URL: z.string().default("http://localhost:5173"),
  PLATFORM_COMMISSION_PERCENT: z.coerce.number().min(0).max(100).default(20),
  TOPUP_BANK_NAME: z.string().default("KEB Hana Bank"),
  TOPUP_ACCOUNT_NUMBER: z.string().default("1234 5678 9101 1234"),
  TOPUP_MIN_AMOUNT: z.coerce.number().int().positive().default(10000),
  PAYOUT_MIN_AMOUNT: z.coerce.number().int().positive().default(50000),
  // Several addresses can be listed, separated by commas.
  UPLOAD_DIR: z.string().default("uploads"),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(30),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(5),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  for (const issue of parsed.error.issues) {
    console.error(` - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

const env = parsed.data;

export const config = {
  nodeEnv: env.NODE_ENV,
  isProduction: env.NODE_ENV === "production",
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
  jwtSecret: env.JWT_SECRET,
  jwtExpiresInSeconds: env.JWT_EXPIRES_IN_DAYS * 24 * 60 * 60,
  clientUrl: env.CLIENT_URL,
  clientOrigins: env.CLIENT_URL.split(",").map((value) => value.trim().replace(/\/+$/, "")).filter(Boolean),
  rateLimitAuthMax: env.RATE_LIMIT_AUTH_MAX,
  commissionPercent: env.PLATFORM_COMMISSION_PERCENT,
  topupBankName: env.TOPUP_BANK_NAME,
  topupAccountNumber: env.TOPUP_ACCOUNT_NUMBER,
  topupMinAmount: env.TOPUP_MIN_AMOUNT,
  payoutMinAmount: env.PAYOUT_MIN_AMOUNT,
  uploadDir: env.UPLOAD_DIR,
  maxUploadMb: env.MAX_UPLOAD_MB,
};
