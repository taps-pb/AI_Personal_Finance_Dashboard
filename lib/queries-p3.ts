// Read layer for Phase 3 features (subscriptions, recurring, budgets).
import { prisma } from "@/lib/db";
import { subscriptionMonthlyEquivalent, type BillingFrequency } from "@/lib/finance/metrics";
import { daysUntil, calculateBudgetUsage, projectedMonthSpend } from "@/lib/finance/recurrence";
import { goalProgress, monthlyContributionRequired } from "@/lib/finance/goals";
import { spendingMinor } from "@/lib/finance/spending";

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export async function getSubscriptionsData(userId: string) {
  const [subs, accounts, categories] = await Promise.all([
    prisma.subscription.findMany({ where: { userId }, orderBy: { nextBillingDate: "asc" } }),
    prisma.account.findMany({ where: { userId } }),
    prisma.category.findMany({ where: { userId } }),
  ]);
  const acct = new Map(accounts.map((a) => [a.id, a]));
  const cat = new Map(categories.map((c) => [c.id, c]));

  const rows = subs.map((s) => ({
    id: s.id,
    name: s.name,
    provider: s.provider,
    amountMinor: s.amountMinor,
    frequency: s.frequency,
    intervalDays: s.intervalDays,
    status: s.status,
    autoRenew: s.autoRenew,
    notes: s.notes,
    accountId: s.accountId,
    accountName: s.accountId ? acct.get(s.accountId)?.name ?? null : null,
    categoryId: s.categoryId,
    categoryName: s.categoryId ? cat.get(s.categoryId)?.name ?? null : null,
    categoryColor: s.categoryId ? cat.get(s.categoryId)?.color ?? "#6366f1" : "#6366f1",
    startISO: s.startDate.toISOString(),
    nextBillingISO: s.nextBillingDate.toISOString(),
    lastChargedISO: s.lastChargedDate ? s.lastChargedDate.toISOString() : null,
    monthlyMinor: subscriptionMonthlyEquivalent(s.amountMinor, s.frequency as BillingFrequency, s.intervalDays ?? undefined),
    daysUntil: daysUntil(s.nextBillingDate),
  }));

  const active = rows.filter((r) => r.status === "active");
  const monthlyMinor = sum(active.map((r) => r.monthlyMinor));
  const window = (days: number) => active.filter((r) => r.daysUntil >= 0 && r.daysUntil <= days);
  const renewals = (days: number) => {
    const w = window(days);
    return { count: w.length, amountMinor: sum(w.map((r) => r.amountMinor)) };
  };

  const byCatMap = new Map<string, { name: string; color: string; amountMinor: number }>();
  for (const r of active) {
    const key = r.categoryName ?? "Uncategorized";
    const cur = byCatMap.get(key) ?? { name: key, color: r.categoryColor, amountMinor: 0 };
    cur.amountMinor += r.monthlyMinor;
    byCatMap.set(key, cur);
  }

  return {
    rows,
    activeCount: active.length,
    monthlyMinor,
    annualMinor: monthlyMinor * 12,
    d7: renewals(7),
    d30: renewals(30),
    d90: renewals(90),
    upcoming: active.filter((r) => r.daysUntil >= 0 && r.daysUntil <= 90).sort((a, b) => a.daysUntil - b.daysUntil),
    mostExpensive: [...active].sort((a, b) => b.monthlyMinor - a.monthlyMinor)[0] ?? null,
    byCategory: [...byCatMap.values()].sort((a, b) => b.amountMinor - a.amountMinor),
  };
}

export async function getRecurringData(userId: string) {
  const [recs, accounts, categories] = await Promise.all([
    prisma.recurringTransaction.findMany({ where: { userId }, orderBy: { nextDate: "asc" } }),
    prisma.account.findMany({ where: { userId } }),
    prisma.category.findMany({ where: { userId } }),
  ]);
  const acct = new Map(accounts.map((a) => [a.id, a]));
  const cat = new Map(categories.map((c) => [c.id, c]));

  return recs.map((r) => ({
    id: r.id,
    type: r.type,
    name: r.name,
    amountMinor: r.amountMinor,
    frequency: r.frequency,
    intervalDays: r.intervalDays,
    accountId: r.accountId,
    accountName: acct.get(r.accountId)?.name ?? "",
    toAccountId: r.toAccountId,
    toAccountName: r.toAccountId ? acct.get(r.toAccountId)?.name ?? null : null,
    categoryId: r.categoryId,
    categoryName: r.categoryId ? cat.get(r.categoryId)?.name ?? null : null,
    nextISO: r.nextDate.toISOString(),
    daysUntil: daysUntil(r.nextDate),
    notes: r.notes,
  }));
}

export async function getBudgetsData(userId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [budgets, categories, txns] = await Promise.all([
    prisma.budget.findMany({ where: { userId } }),
    prisma.category.findMany({ where: { userId } }),
    prisma.transaction.findMany({
      where: { userId, date: { gte: monthStart } },
      select: { type: true, amountMinor: true, feeMinor: true, categoryId: true },
    }),
  ]);
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const childrenOf = (id: string) => categories.filter((c) => c.parentId === id).map((c) => c.id);

  // Spend per leaf category this month.
  const leafSpend = new Map<string, number>();
  let totalSpend = 0;
  for (const t of txns) {
    const amt = spendingMinor(t);
    if (amt <= 0) continue;
    totalSpend += amt;
    if (t.categoryId) leafSpend.set(t.categoryId, (leafSpend.get(t.categoryId) ?? 0) + amt);
  }
  const spentFor = (catId: string) => (leafSpend.get(catId) ?? 0) + sum(childrenOf(catId).map((c) => leafSpend.get(c) ?? 0));

  const rows = budgets
    .map((b) => {
      const spent = b.categoryId ? spentFor(b.categoryId) : totalSpend;
      const usage = calculateBudgetUsage(spent, b.amountMinor);
      return {
        id: b.id,
        categoryId: b.categoryId,
        name: b.categoryId ? catMap.get(b.categoryId)?.name ?? "Category" : "Overall monthly",
        color: b.categoryId ? catMap.get(b.categoryId)?.color ?? "#6366f1" : "#6366f1",
        amountMinor: b.amountMinor,
        spentMinor: spent,
        remainingMinor: usage.remainingMinor,
        pct: usage.pct,
        status: usage.status,
        projectedMinor: projectedMonthSpend(spent, now),
      };
    })
    .sort((a, b) => (a.categoryId === null ? -1 : b.categoryId === null ? 1 : b.pct - a.pct));

  const budgetedIds = new Set(budgets.map((b) => b.categoryId));
  const availableCategories = categories
    .filter((c) => c.kind === "expense" && !c.parentId && !budgetedIds.has(c.id))
    .map((c) => ({ id: c.id, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { rows, availableCategories, hasOverall: budgets.some((b) => b.categoryId === null) };
}

export async function getGoalsData(userId: string) {
  const now = new Date();
  const [goals, accounts] = await Promise.all([
    prisma.savingsGoal.findMany({ where: { userId } }),
    prisma.account.findMany({ where: { userId } }),
  ]);
  const acct = new Map(accounts.map((a) => [a.id, a]));

  return goals
    .map((g) => {
      const p = goalProgress(g.currentMinor, g.targetMinor);
      return {
        id: g.id,
        name: g.name,
        targetMinor: g.targetMinor,
        currentMinor: g.currentMinor,
        targetISO: g.targetDate ? g.targetDate.toISOString() : null,
        targetDaysUntil: g.targetDate ? daysUntil(g.targetDate, now) : null,
        priority: g.priority,
        notes: g.notes,
        linkedAccountId: g.linkedAccountId,
        linkedAccountName: g.linkedAccountId ? acct.get(g.linkedAccountId)?.name ?? null : null,
        pct: p.pct,
        remainingMinor: p.remainingMinor,
        reached: p.reached,
        monthlyRequiredMinor: monthlyContributionRequired(p.remainingMinor, g.targetDate, now),
      };
    })
    .sort((a, b) => {
      if (a.reached !== b.reached) return a.reached ? 1 : -1;
      const pr = (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1);
      return pr !== 0 ? pr : b.pct - a.pct;
    });
}
