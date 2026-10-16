import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateCost, splitCharge } from "../../src/lib/money.js";

test("cost is charged per second and rounded to a whole won", () => {
  assert.equal(calculateCost(1500, 60), 1500);
  assert.equal(calculateCost(1500, 30), 750);
  assert.equal(calculateCost(1000, 1), 17);
  assert.equal(calculateCost(1500, 0), 0);
});

test("the platform commission and the translator earning add up to the charge", () => {
  const { commission, earning } = splitCharge(1000, 20);
  assert.equal(commission, 200);
  assert.equal(earning, 800);
  for (const charge of [1, 7, 333, 12345]) {
    const result = splitCharge(charge, 20);
    assert.equal(result.commission + result.earning, charge);
  }
});

test("zero commission leaves everything to the translator", () => {
  assert.deepEqual(splitCharge(500, 0), { commission: 0, earning: 500 });
});
