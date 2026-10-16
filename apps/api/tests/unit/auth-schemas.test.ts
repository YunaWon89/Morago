import "../helpers/env.js";
import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizePhone, registerSchema, resetPasswordSchema, verifyResetCodeSchema } from "../../src/modules/auth/auth.schemas.js";

test("phone numbers are cleaned from spaces and dashes", () => {
  assert.equal(normalizePhone("010 1234-56 78"), "01012345678");
  assert.equal(normalizePhone("+82 (10) 1234.5678"), "+821012345678");
});

const valid = {
  phone: "010-1234-5678",
  code: "123456",
  password: "secret1234",
  fullName: "Kim Dmitrii",
  email: "Kim@Example.com",
  role: "USER",
};

test("registration accepts valid data and normalises it", () => {
  const parsed = registerSchema.parse(valid);
  assert.equal(parsed.phone, "01012345678");
  assert.equal(parsed.email, "kim@example.com");
});

test("registration rejects a short password, a bad code and the ADMIN role", () => {
  assert.equal(registerSchema.safeParse({ ...valid, password: "short" }).success, false);
  assert.equal(registerSchema.safeParse({ ...valid, code: "12ab" }).success, false);
  assert.equal(registerSchema.safeParse({ ...valid, role: "ADMIN" }).success, false);
});

test("password reset by SMS code needs a 6-digit code and a long enough password", () => {
  assert.equal(verifyResetCodeSchema.safeParse({ phone: "01012345678", code: "123456" }).success, true);
  assert.equal(verifyResetCodeSchema.safeParse({ phone: "01012345678", code: "1234" }).success, false);
  assert.equal(resetPasswordSchema.safeParse({ token: "a".repeat(64), password: "short" }).success, false);
});
