import assert from "node:assert/strict";
import { test } from "node:test";
import "../helpers/env.js";

const { handleSignal } = await import("../../src/realtime/socket.js");
const user = { id: 1, role: "USER" } as Parameters<typeof handleSignal>[0];

test("a string instead of the callback does not crash the handler", async () => {
  await assert.doesNotReject(handleSignal(user, {}, "bad"));
});

test("an object instead of the callback does not crash the handler", async () => {
  await assert.doesNotReject(handleSignal(user, { callId: "x" }, { not: "a function" }));
});

test("a real callback gets an error for an invalid signal", async () => {
  let answer: unknown;
  await handleSignal(user, {}, (result: unknown) => {
    answer = result;
  });
  assert.deepEqual(answer, { ok: false, error: "Invalid signal" });
});

test("a callback that throws does not crash the handler", async () => {
  await assert.doesNotReject(
    handleSignal(user, {}, () => {
      throw new Error("boom");
    }),
  );
});
