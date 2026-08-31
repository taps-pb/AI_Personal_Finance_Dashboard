// Savings-goal math (spec §20). Pure, paise integers.
import { daysUntil } from "./recurrence.ts";

export function goalProgress(currentMinor: number, targetMinor: number) {
  const pct = targetMinor > 0 ? (currentMinor / targetMinor) * 100 : 0;
  const remainingMinor = Math.max(targetMinor - currentMinor, 0);
  return { pct, remainingMinor, reached: currentMinor >= targetMinor && targetMinor > 0 };
}

/** Whole months until a date, at least 1 (≈30-day months). */
export function monthsUntil(targetDate: Date | string, now: Date = new Date()): number {
  const days = daysUntil(targetDate, now);
  if (days <= 0) return 0;
  return Math.max(1, Math.ceil(days / 30));
}

/** Monthly contribution needed to hit a goal by its target date (null if no date). */
export function monthlyContributionRequired(
  remainingMinor: number,
  targetDate: Date | string | null,
  now: Date = new Date(),
): number | null {
  if (remainingMinor <= 0) return 0;
  if (!targetDate) return null;
  const months = monthsUntil(targetDate, now);
  if (months <= 0) return remainingMinor; // due now/past
  return Math.ceil(remainingMinor / months);
}

/** Straight-line month-end spend forecast (spec §17): spent + extrapolated variable + known upcoming. */
export function forecastMonthEnd(spentSoFarMinor: number, upcomingKnownMinor: number, now: Date = new Date()): number {
  const day = now.getDate();
  const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = dim - day;
  const avgDaily = day > 0 ? spentSoFarMinor / day : 0;
  const expectedVariable = Math.round(avgDaily * daysRemaining);
  return spentSoFarMinor + expectedVariable + upcomingKnownMinor;
}
