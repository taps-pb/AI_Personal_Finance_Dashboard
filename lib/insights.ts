// Deterministic financial insights (spec §16). Every FACT is computed here — no
// LLM invention. A few gentle SUGGESTIONS come from explicit rules and are
// clearly labelled as suggestions, not facts.
import { prisma } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { totalSpending, totalIncome, spendingMinor } from "@/lib/finance/spending";
import { getSubscriptionsData, getBudgetsData } from "@/lib/queries-p3";
import { getNetWorthSnapshots } from "@/lib/snapshot";

export interface Insight {
  kind: "fact" | "suggestion";
  text: string;
  tone?: "positive" | "negative" | "neutral";
}

function monthTxns<T extends { date: Date }>(txns: T[], y: number, m: number) {
  return txns.filter((t) => t.date.getFullYear() === y && t.date.getMonth() === m);
}

export async function getInsights(userId: string): Promise<Insight[]> {
  const now = new Date();
  const since = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const [txns, categories, subs, budgets, snapshots] = await Promise.all([
    prisma.transaction.findMany({ where: { userId, date: { gte: since } } }),
    prisma.category.findMany({ where: { userId } }),
    getSubscriptionsData(userId),
    getBudgetsData(userId),
    getNetWorthSnapshots(userId),
  ]);
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const out: Insight[] = [];

  const thisM = monthTxns(txns, now.getFullYear(), now.getMonth());
  const lastDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastM = monthTxns(txns, lastDate.getFullYear(), lastDate.getMonth());

  const spendThis = totalSpending(thisM);
  const spendLast = totalSpending(lastM);

  // Month-over-month spending.
  if (spendLast > 0) {
    const pct = ((spendThis - spendLast) / spendLast) * 100;
    out.push({
      kind: "fact",
      text: `Your spending this month (${formatINR(spendThis)}) is ${Math.abs(pct).toFixed(0)}% ${pct >= 0 ? "higher" : "lower"} than last month (${formatINR(spendLast)}).`,
      tone: pct > 10 ? "negative" : pct < -10 ? "positive" : "neutral",
    });
  }

  // Average daily spend this month.
  if (spendThis > 0) {
    out.push({ kind: "fact", text: `Your average daily spending this month is ${formatINR(Math.round(spendThis / now.getDate()))}.` });
  }

  // Biggest category increase vs last month.
  const catThis = new Map<string, number>();
  const catLast = new Map<string, number>();
  for (const t of thisM) if (spendingMinor(t) > 0 && t.categoryId) catThis.set(t.categoryId, (catThis.get(t.categoryId) ?? 0) + spendingMinor(t));
  for (const t of lastM) if (spendingMinor(t) > 0 && t.categoryId) catLast.set(t.categoryId, (catLast.get(t.categoryId) ?? 0) + spendingMinor(t));
  let topCat: { id: string; pct: number; amt: number } | null = null;
  for (const [id, amt] of catThis) {
    const prev = catLast.get(id) ?? 0;
    if (prev <= 0) continue;
    const pct = ((amt - prev) / prev) * 100;
    if (pct > 15 && (!topCat || pct > topCat.pct)) topCat = { id, pct, amt };
  }
  if (topCat) {
    out.push({ kind: "fact", text: `${catMap.get(topCat.id)?.name ?? "A category"} spending is ${topCat.pct.toFixed(0)}% higher than last month (${formatINR(topCat.amt)}).`, tone: "negative" });
  }

  // Largest expense this month.
  const largest = [...thisM].filter((t) => spendingMinor(t) > 0).sort((a, b) => spendingMinor(b) - spendingMinor(a))[0];
  if (largest) {
    const cat = largest.categoryId ? catMap.get(largest.categoryId)?.name : null;
    out.push({ kind: "fact", text: `Your largest expense this month was ${formatINR(spendingMinor(largest))} on ${largest.name}${cat ? ` (${cat})` : ""}.` });
  }

  // Three consecutive months of rising spend.
  const m0 = totalSpending(monthTxns(txns, now.getFullYear(), now.getMonth()));
  const m1 = totalSpending(monthTxns(txns, lastDate.getFullYear(), lastDate.getMonth()));
  const twoAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const m2 = totalSpending(monthTxns(txns, twoAgo.getFullYear(), twoAgo.getMonth()));
  if (m2 > 0 && m1 > m2 && m0 > m1) {
    out.push({ kind: "fact", text: `Your monthly spending has risen three months running (${formatINR(m2)} → ${formatINR(m1)} → ${formatINR(m0)}).`, tone: "negative" });
  }

  // Subscriptions.
  if (subs.monthlyMinor > 0) {
    out.push({ kind: "fact", text: `You spend about ${formatINR(subs.monthlyMinor)}/month on subscriptions (${formatINR(subs.annualMinor)}/year).` });
  }
  if (subs.d30.count > 0) {
    out.push({ kind: "fact", text: `You have ${formatINR(subs.d30.amountMinor)} of subscriptions renewing within the next 30 days.` });
  }

  // Net worth change over available snapshots.
  if (snapshots.length >= 2) {
    const first = snapshots[0].netWorthMinor;
    const last = snapshots[snapshots.length - 1].netWorthMinor;
    if (first > 0) {
      const pct = ((last - first) / first) * 100;
      out.push({ kind: "fact", text: `Your net worth is ${pct >= 0 ? "up" : "down"} ${Math.abs(pct).toFixed(1)}% over the tracked period (now ${formatINR(last)}).`, tone: pct >= 0 ? "positive" : "negative" });
    }
  }

  // Income coverage this month.
  const incomeThis = totalIncome(thisM);
  if (incomeThis > 0 && spendThis > incomeThis) {
    out.push({ kind: "suggestion", text: `You've spent more than you earned this month (${formatINR(spendThis)} vs ${formatINR(incomeThis)}). Consider trimming variable spending.`, tone: "negative" });
  }

  // Budget suggestions.
  for (const b of budgets.rows) {
    if (b.status === "exceeded") {
      out.push({ kind: "suggestion", text: `You're over your ${b.name} budget by ${formatINR(-b.remainingMinor)}. Consider easing off for the rest of the month.`, tone: "negative" });
    } else if (b.status === "warning") {
      out.push({ kind: "fact", text: `You've used ${b.pct.toFixed(0)}% of your ${b.name} budget.`, tone: "negative" });
    }
  }

  // Priciest subscription — a review nudge.
  if (subs.mostExpensive) {
    out.push({ kind: "suggestion", text: `Your priciest subscription is ${subs.mostExpensive.name} at ${formatINR(subs.mostExpensive.monthlyMinor)}/month — worth reviewing if you still use it.` });
  }

  return out;
}
