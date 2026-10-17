import assert from "node:assert/strict";
import { test } from "node:test";
import "../helpers/env.js";

const { findDeadCalls } = await import("../../src/modules/calls/calls.service.js");

const T0 = Date.parse("2026-10-17T10:00:00Z");
const call = { id: 1, clientId: 10, translatorId: 20, startedAt: new Date(T0) };
const key = (userId: number) => `1:${userId}`;

test("a call with fresh heartbeats from both sides stays open", () => {
  const seen = new Map([[key(10), T0 + 55_000], [key(20), T0 + 58_000]]);
  assert.deepEqual(findDeadCalls([call], seen, T0 + 60_000, 0), []);
});

test("a silent participant ends the call, charged only up to the last heartbeat", () => {
  const seen = new Map([[key(10), T0 + 100_000], [key(20), T0 + 40_000]]);
  const dead = findDeadCalls([call], seen, T0 + 100_000, 0);
  assert.equal(dead.length, 1);
  assert.equal(dead[0]!.endedAt.getTime(), T0 + 40_000);
});

test("a call without any heartbeat is charged at most from its start", () => {
  const dead = findDeadCalls([call], new Map(), T0 + 60_000, 0);
  assert.equal(dead.length, 1);
  assert.equal(dead[0]!.endedAt.getTime(), T0);
});

test("after a server restart the call gets a fresh grace period", () => {
  const boot = T0 + 3_600_000;
  assert.deepEqual(findDeadCalls([call], new Map(), boot + 10_000, boot), []);
  assert.equal(findDeadCalls([call], new Map(), boot + 40_000, boot).length, 1);
});

const { chargeUntil } = await import("../../src/modules/calls/calls.service.js");

test("a normal end of the call is charged until now", () => {
  const now = T0 + 120_000;
  assert.equal(chargeUntil(now, now - 3_000, new Date(T0)).getTime(), now);
});

test("an end after the other side went silent is charged only until its last heartbeat", () => {
  const now = T0 + 120_000;
  assert.equal(chargeUntil(now, now - 15_000, new Date(T0)).getTime(), now - 15_000);
});

test("without a known heartbeat the call is charged until now", () => {
  assert.equal(chargeUntil(T0 + 60_000, undefined, new Date(T0)).getTime(), T0 + 60_000);
});

test("silence is never charged before the start of the call", () => {
  assert.equal(chargeUntil(T0 + 60_000, T0 - 5_000, new Date(T0)).getTime(), T0);
});
