import { test } from "node:test";
import assert from "node:assert/strict";
import { advance, addMonths, daysUntil, nextByDayOfMonth, calculateBudgetUsage, projectedMonthSpend } from "../lib/finance/recurrence.ts";
import { subscriptionMonthlyEquivalent, subscriptionAnnualCost } from "../lib/finance/metrics.ts";

test("addMonths clamps day to month length", () => {
  assert.equal(addMonths(new Date(2026, 0, 31), 1).getMonth(), 1); // Jan 31 -> Feb
  assert.equal(addMonths(new Date(2026, 0, 31), 1).getDate(), 28); // clamped, not Mar 3
});

test("advance moves by frequency", () => {
  const d = new Date(2026, 5, 15);
  assert.equal(advance(d, "weekly").getDate(), 22);
  assert.equal(advance(d, "monthly").getMonth(), 6);
  assert.equal(advance(d, "quarterly").getMonth(), 8);
  assert.equal(advance(d, "yearly").getFullYear(), 2027);
  assert.equal(advance(d, "custom", 10).getDate(), 25);
});

test("daysUntil is date-based", () => {
  const now = new Date(2026, 7, 30, 15, 0);
  assert.equal(daysUntil(new Date(2026, 7, 30, 1, 0), now), 0);
  assert.equal(daysUntil(new Date(2026, 8, 2), now), 3);
  assert.equal(daysUntil(new Date(2026, 7, 28), now), -2);
});

test("nextByDayOfMonth picks this or next month", () => {
  const now = new Date(2026, 7, 10); // Aug 10
  assert.equal(nextByDayOfMonth(22, now).getDate(), 22); // later this month
  assert.equal(nextByDayOfMonth(5, now).getMonth(), 8); // already passed -> Sep
});

test("budget usage thresholds (spec §12)", () => {
  assert.equal(calculateBudgetUsage(0, 800000).status, "normal");
  assert.equal(calculateBudgetUsage(600000, 800000).status, "approaching"); // 75%
  assert.equal(calculateBudgetUsage(760000, 800000).status, "warning"); // 95%
  assert.equal(calculateBudgetUsage(900000, 800000).status, "exceeded"); // 112%
  assert.equal(calculateBudgetUsage(300000, 800000).remainingMinor, 500000);
  assert.equal(calculateBudgetUsage(100, 0).pct, 0); // no divide-by-zero
});

test("projected month spend is straight-line", () => {
  const now = new Date(2026, 7, 10); // day 10 of a 31-day month
  assert.equal(projectedMonthSpend(1000000, now), Math.round((1000000 / 10) * 31));
});

test("subscription monthly/annual conversion (spec §8)", () => {
  assert.equal(subscriptionMonthlyEquivalent(1200000, "yearly"), 100000); // ₹12,000/yr -> ₹1,000/mo
  assert.equal(subscriptionAnnualCost(199900, "monthly"), 2398800);
});
