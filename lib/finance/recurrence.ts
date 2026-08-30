// Pure date/recurrence + budget helpers (spec §8/§12/§19). No DB, no floats-for-money.
import type { BillingFrequency } from "./metrics.ts";

const daysInMonth = (year: number, month0: number) => new Date(year, month0 + 1, 0).getDate();

/** Add `n` months to a date, clamping the day to the target month's length. */
export function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  const targetMonth = d.getMonth() + n;
  const y = d.getFullYear() + Math.floor(targetMonth / 12);
  const m = ((targetMonth % 12) + 12) % 12;
  const day = Math.min(d.getDate(), daysInMonth(y, m));
  return new Date(y, m, day, d.getHours(), d.getMinutes());
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** Next occurrence after `date` for a billing frequency. */
export function advance(date: Date, frequency: BillingFrequency, intervalDays?: number | null): Date {
  switch (frequency) {
    case "weekly":
      return addDays(date, 7);
    case "monthly":
      return addMonths(date, 1);
    case "every2months":
      return addMonths(date, 2);
    case "quarterly":
      return addMonths(date, 3);
    case "every6months":
      return addMonths(date, 6);
    case "yearly":
      return addMonths(date, 12);
    case "custom":
      return addDays(date, intervalDays && intervalDays > 0 ? intervalDays : 30);
  }
}

/** Whole days from today (midnight) until `date` (midnight). Negative if past. */
export function daysUntil(date: Date | string, now: Date = new Date()): number {
  const a = new Date(now).setHours(0, 0, 0, 0);
  const b = new Date(date).setHours(0, 0, 0, 0);
  return Math.round((b - a) / 86_400_000);
}

/** Next calendar date landing on `day`-of-month, on/after today (clamped to month length). */
export function nextByDayOfMonth(day: number, now: Date = new Date()): Date {
  const y = now.getFullYear();
  const m = now.getMonth();
  const thisMonthDay = Math.min(day, daysInMonth(y, m));
  const candidate = new Date(y, m, thisMonthDay);
  if (candidate >= new Date(y, m, now.getDate())) return candidate;
  const nm = m + 1;
  return new Date(y + Math.floor(nm / 12), nm % 12, Math.min(day, daysInMonth(y + Math.floor(nm / 12), nm % 12)));
}

export type BudgetStatus = "normal" | "approaching" | "warning" | "exceeded";

/** Budget usage (spec §12). Thresholds: <70 normal, 70–90 approaching, 90–100 warning, ≥100 exceeded. */
export function calculateBudgetUsage(spentMinor: number, budgetMinor: number) {
  const pct = budgetMinor > 0 ? (spentMinor / budgetMinor) * 100 : 0;
  const remainingMinor = budgetMinor - spentMinor;
  let status: BudgetStatus = "normal";
  if (pct >= 100) status = "exceeded";
  else if (pct >= 90) status = "warning";
  else if (pct >= 70) status = "approaching";
  return { pct, remainingMinor, status };
}

/** Straight-line projected month-end spend from spend-so-far (spec §12/§17). */
export function projectedMonthSpend(spentMinor: number, now: Date = new Date()): number {
  const day = now.getDate();
  const dim = daysInMonth(now.getFullYear(), now.getMonth());
  if (day <= 0) return spentMinor;
  return Math.round((spentMinor / day) * dim);
}
