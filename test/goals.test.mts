import { test } from "node:test";
import assert from "node:assert/strict";
import { goalProgress, monthlyContributionRequired, forecastMonthEnd } from "../lib/finance/goals.ts";

test("goal progress + remaining", () => {
  const g = goalProgress(5000000, 20000000); // ₹50k of ₹2L
  assert.equal(g.pct, 25);
  assert.equal(g.remainingMinor, 15000000);
  assert.equal(g.reached, false);
  assert.equal(goalProgress(20000000, 20000000).reached, true);
});

test("monthly contribution required", () => {
  const now = new Date(2026, 0, 1);
  // ~6 months to July 1 -> remaining / 6
  const need = monthlyContributionRequired(6000000, new Date(2026, 6, 1), now);
  assert.ok(need && need > 0 && need <= 6000000);
  assert.equal(monthlyContributionRequired(6000000, null, now), null); // no date
  assert.equal(monthlyContributionRequired(0, new Date(2026, 6, 1), now), 0); // already funded
});

test("forecast month-end spend adds variable + upcoming (spec §17)", () => {
  const now = new Date(2026, 7, 10); // day 10 of 31
  // spent 1000000 over 10 days -> avg 100000/day, 21 days left -> +2100000, + upcoming 300000
  assert.equal(forecastMonthEnd(1000000, 300000, now), 1000000 + 2100000 + 300000);
});
