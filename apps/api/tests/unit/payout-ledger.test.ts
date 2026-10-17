import assert from "node:assert/strict";
import { test } from "node:test";
import "../helpers/env.js";

const { payoutLedger } = await import("../../src/modules/payouts/payouts.service.js");

function completedSum(entries: { amount: number; status: string }[]) {
  return entries.filter((entry) => entry.status === "COMPLETED").reduce((sum, entry) => sum + entry.amount, 0);
}

test("a pending payout takes the money from the balance", () => {
  assert.equal(completedSum(payoutLedger("PENDING", 60000)), -60000);
});

test("a paid payout leaves the balance as it was after the request", () => {
  assert.equal(completedSum(payoutLedger("PAID", 60000)), -60000);
});

test("a rejected payout returns the money, the ledger sums to zero", () => {
  assert.equal(completedSum(payoutLedger("REJECTED", 60000)), 0);
});
