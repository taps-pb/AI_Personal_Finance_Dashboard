// Analytics engine (spec §42/§43/§44). Combines Prisma data with pure finance
// libs into a serializable payload for the analytics page.
import { prisma } from "@/lib/db";
import { totalSpending, totalIncome, spendingMinor } from "@/lib/finance/spending";
import { addDays, addMonths } from "@/lib/finance/recurrence";
import { forecastMonthEnd } from "@/lib/finance/goals";
import { getNetWorthSnapshots } from "@/lib/snapshot";
import { subscriptionMonthlyEquivalent, type BillingFrequency } from "@/lib/finance/metrics";
import type { RangeKey } from "@/lib/ranges";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function resolveRange(range: RangeKey, fromStr: string | undefined, toStr: string | undefined, now: Date) {
  let from: Date;
  let to = endOfDay(now);
  switch (range) {
    case "7d":
      from = startOfDay(addDays(now, -6));
      break;
    case "30d":
      from = startOfDay(addDays(now, -29));
      break;
    case "this":
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "last":
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      to = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
      break;
    case "3m":
      from = startOfDay(addMonths(now, -3));
      break;
    case "6m":
      from = startOfDay(addMonths(now, -6));
      break;
    case "1y":
      from = startOfDay(addMonths(now, -12));
      break;
    case "all":
      from = new Date(2000, 0, 1);
      break;
    case "custom":
      from = fromStr ? startOfDay(new Date(`${fromStr}T00:00:00`)) : startOfDay(addDays(now, -29));
      to = toStr ? endOfDay(new Date(`${toStr}T00:00:00`)) : endOfDay(now);
      break;
  }
  const spanMs = to.getTime() - from.getTime();
  const hasPrev = range !== "all";
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(from.getTime() - 1 - spanMs);
  return { from, to, prevFrom, prevTo, hasPrev, spanDays: Math.ceil(spanMs / 86_400_000) };
}

function inRange(d: Date, from: Date, to: Date) {
  return d >= from && d <= to;
}

const pctChange = (cur: number, prev: number): number | null => (prev > 0 ? ((cur - prev) / prev) * 100 : null);

export async function getAnalytics(userId: string, opts: { range: RangeKey; from?: string; to?: string }) {
  const now = new Date();
  const { from, to, prevFrom, prevTo, hasPrev, spanDays } = resolveRange(opts.range, opts.from, opts.to, now);

  const [allTxns, accounts, categories, snapshots, subs, recs] = await Promise.all([
    prisma.transaction.findMany({ where: { userId, date: { gte: prevFrom, lte: to } }, orderBy: { date: "desc" } }),
    prisma.account.findMany({ where: { userId } }),
    prisma.category.findMany({ where: { userId } }),
    getNetWorthSnapshots(userId, from, to),
    prisma.subscription.findMany({ where: { userId, status: "active" } }),
    prisma.recurringTransaction.findMany({ where: { userId } }),
  ]);
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const acctMap = new Map(accounts.map((a) => [a.id, a]));

  const period = allTxns.filter((t) => inRange(t.date, from, to));
  const prev = allTxns.filter((t) => inRange(t.date, prevFrom, prevTo));

  const spending = totalSpending(period);
  const income = totalIncome(period);
  const prevSpending = totalSpending(prev);
  const prevIncome = totalIncome(prev);

  const spendTxnCount = period.filter((t) => spendingMinor(t) > 0).length;
  const days = Math.max(1, spanDays);

  // --- trend buckets --------------------------------------------------------
  const daily = spanDays <= 45;
  const trend: { label: string; spendingMinor: number; incomeMinor: number }[] = [];
  if (daily) {
    for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
      const key = startOfDay(d).getTime();
      const bucket = period.filter((t) => startOfDay(new Date(t.date)).getTime() === key);
      trend.push({ label: `${new Date(d).getDate()}/${new Date(d).getMonth() + 1}`, spendingMinor: totalSpending(bucket), incomeMinor: totalIncome(bucket) });
    }
  } else {
    const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    const last = new Date(to.getFullYear(), to.getMonth(), 1);
    while (cursor <= last) {
      const y = cursor.getFullYear();
      const m = cursor.getMonth();
      const bucket = period.filter((t) => {
        const td = new Date(t.date);
        return td.getFullYear() === y && td.getMonth() === m;
      });
      trend.push({ label: MONTHS[m], spendingMinor: totalSpending(bucket), incomeMinor: totalIncome(bucket) });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  // --- category breakdown with comparison ----------------------------------
  const catAgg = new Map<string, number>();
  const catAggPrev = new Map<string, number>();
  const bump = (map: Map<string, number>, key: string, v: number) => map.set(key, (map.get(key) ?? 0) + v);
  for (const t of period) if (spendingMinor(t) > 0) bump(catAgg, t.categoryId ?? "uncategorized", spendingMinor(t));
  for (const t of prev) if (spendingMinor(t) > 0) bump(catAggPrev, t.categoryId ?? "uncategorized", spendingMinor(t));
  const categoryBreakdown = [...catAgg.entries()]
    .map(([id, amountMinor]) => ({
      id,
      name: id === "uncategorized" ? "Uncategorized" : catMap.get(id)?.name ?? "Uncategorized",
      color: catMap.get(id)?.color ?? "#94a3b8",
      amountMinor,
      prevMinor: catAggPrev.get(id) ?? 0,
      changePct: pctChange(amountMinor, catAggPrev.get(id) ?? 0),
    }))
    .sort((a, b) => b.amountMinor - a.amountMinor);

  // --- account usage --------------------------------------------------------
  const acctAgg = new Map<string, number>();
  for (const t of period) if (spendingMinor(t) > 0) bump(acctAgg, t.accountId, spendingMinor(t));
  const accountUsage = [...acctAgg.entries()]
    .map(([id, amountMinor]) => ({ id, name: acctMap.get(id)?.name ?? "", color: acctMap.get(id)?.color ?? "#6366f1", amountMinor }))
    .sort((a, b) => b.amountMinor - a.amountMinor);

  // --- merchant breakdown ---------------------------------------------------
  const merchMap = new Map<string, { totalMinor: number; count: number; lastISO: string }>();
  for (const t of period) {
    if (!t.merchant || spendingMinor(t) <= 0) continue;
    const iso = t.date.toISOString();
    const cur = merchMap.get(t.merchant) ?? { totalMinor: 0, count: 0, lastISO: iso };
    cur.totalMinor += spendingMinor(t);
    cur.count += 1;
    if (iso > cur.lastISO) cur.lastISO = iso;
    merchMap.set(t.merchant, cur);
  }
  const merchantBreakdown = [...merchMap.entries()]
    .map(([merchant, v]) => ({ merchant, totalMinor: v.totalMinor, count: v.count, avgMinor: Math.round(v.totalMinor / v.count), lastISO: v.lastISO }))
    .sort((a, b) => b.totalMinor - a.totalMinor)
    .slice(0, 10);

  // --- largest expenses -----------------------------------------------------
  const largestExpenses = period
    .filter((t) => spendingMinor(t) > 0)
    .sort((a, b) => spendingMinor(b) - spendingMinor(a))
    .slice(0, 5)
    .map((t) => ({
      id: t.id,
      name: t.name,
      amountMinor: spendingMinor(t),
      accountName: acctMap.get(t.accountId)?.name ?? "",
      categoryName: t.categoryId ? catMap.get(t.categoryId)?.name ?? null : null,
    }));

  // --- net worth movement ---------------------------------------------------
  const nwSeries = snapshots.map((s) => ({ label: `${new Date(s.date).getDate()}/${new Date(s.date).getMonth() + 1}`, netWorthMinor: s.netWorthMinor }));
  const nwStart = snapshots[0]?.netWorthMinor ?? null;
  const nwEnd = snapshots[snapshots.length - 1]?.netWorthMinor ?? null;
  const netWorthMovement =
    nwStart != null && nwEnd != null ? { startMinor: nwStart, endMinor: nwEnd, changeMinor: nwEnd - nwStart, changePct: pctChange(nwEnd, nwStart) } : null;

  // --- forecast (only for the current month) --------------------------------
  let forecast: { expectedSpendingMinor: number; upcomingKnownMinor: number; daysRemaining: number } | null = null;
  if (opts.range === "this") {
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    let upcoming = 0;
    for (const s of subs) if (s.nextBillingDate > now && s.nextBillingDate <= monthEnd) upcoming += s.amountMinor;
    for (const rt of recs) if (rt.type === "EXPENSE" && rt.nextDate > now && rt.nextDate <= monthEnd) upcoming += rt.amountMinor;
    forecast = {
      expectedSpendingMinor: forecastMonthEnd(spending, upcoming, now),
      upcomingKnownMinor: upcoming,
      daysRemaining: monthEnd.getDate() - now.getDate(),
    };
  }

  const activeSubMonthly = subs.reduce((s, x) => s + subscriptionMonthlyEquivalent(x.amountMinor, x.frequency as BillingFrequency, x.intervalDays ?? undefined), 0);

  return {
    range: opts.range,
    fromISO: from.toISOString(),
    toISO: to.toISOString(),
    hasPrev,
    spending,
    income,
    cashFlowMinor: income - spending,
    savingsRatePct: income > 0 ? ((income - spending) / income) * 100 : 0,
    spendingChangePct: hasPrev ? pctChange(spending, prevSpending) : null,
    incomeChangePct: hasPrev ? pctChange(income, prevIncome) : null,
    prevSpendingMinor: prevSpending,
    avgDailySpendMinor: Math.round(spending / days),
    avgTxnSizeMinor: spendTxnCount > 0 ? Math.round(spending / spendTxnCount) : 0,
    txnCount: period.length,
    trend,
    categoryBreakdown,
    accountUsage,
    merchantBreakdown,
    largestExpenses,
    nwSeries,
    netWorthMovement,
    forecast,
    subscriptionMonthlyMinor: activeSubMonthly,
  };
}
