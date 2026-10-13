// Per-second billing: the price is given per minute, the result is rounded to a whole won.
export function calculateCost(pricePerMinute: number, durationSec: number): number {
  return Math.round((pricePerMinute * durationSec) / 60);
}

// The platform keeps a percentage of the charge, the translator gets the rest.
export function splitCharge(charge: number, commissionPercent: number) {
  const commission = Math.round((charge * commissionPercent) / 100);
  return { commission, earning: charge - commission };
}
