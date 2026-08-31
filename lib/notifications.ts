// In-app notifications (spec §47). Deterministic, computed from current data.
import { prisma } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { daysUntil, nextByDayOfMonth } from "@/lib/finance/recurrence";
import { LIQUID_ACCOUNT_TYPES } from "@/lib/constants";
import { getBudgetsData } from "@/lib/queries-p3";

export interface AppNotification {
  text: string;
  tone: "warning" | "negative" | "positive" | "neutral";
  href: string;
  urgency: number; // lower = more urgent, for sorting
}

const LOW_BALANCE_MINOR = 100000; // ₹1,000

export async function getNotifications(userId: string): Promise<AppNotification[]> {
  const now = new Date();
  const [subs, accounts, goals, recs, budgets] = await Promise.all([
    prisma.subscription.findMany({ where: { userId, status: "active" } }),
    prisma.account.findMany({ where: { userId, status: "active" } }),
    prisma.savingsGoal.findMany({ where: { userId } }),
    prisma.recurringTransaction.findMany({ where: { userId } }),
    getBudgetsData(userId),
  ]);
  const out: AppNotification[] = [];

  for (const s of subs) {
    const d = daysUntil(s.nextBillingDate, now);
    if (d >= 0 && d <= 1) out.push({ text: `${s.name} renews ${d === 0 ? "today" : "tomorrow"} (${formatINR(s.amountMinor)}).`, tone: "warning", href: "/subscriptions", urgency: d });
  }

  for (const a of accounts) {
    if (a.type === "Credit Card" && a.dueDay && a.balanceMinor > 0) {
      const d = daysUntil(nextByDayOfMonth(a.dueDay, now), now);
      if (d <= 3) out.push({ text: `${a.name} payment due ${d <= 0 ? "now" : `in ${d} day${d === 1 ? "" : "s"}`} (${formatINR(a.balanceMinor)}).`, tone: "negative", href: `/accounts/${a.id}`, urgency: d });
    }
    if (LIQUID_ACCOUNT_TYPES.includes(a.type) && a.balanceMinor >= 0 && a.balanceMinor < LOW_BALANCE_MINOR) {
      out.push({ text: `Low balance: ${a.name} is at ${formatINR(a.balanceMinor)}.`, tone: "warning", href: `/accounts/${a.id}`, urgency: 2 });
    }
  }

  for (const r of recs) {
    const d = daysUntil(r.nextDate, now);
    if (d <= 0) out.push({ text: `Recurring due: ${r.name} (${formatINR(r.amountMinor)}).`, tone: "warning", href: "/subscriptions", urgency: 1 });
  }

  for (const b of budgets.rows) {
    if (b.status === "exceeded") out.push({ text: `Over budget: ${b.name} (${b.pct.toFixed(0)}% used).`, tone: "negative", href: "/budgets", urgency: 1 });
    else if (b.status === "warning") out.push({ text: `Budget alert: ${b.pct.toFixed(0)}% of ${b.name} used.`, tone: "warning", href: "/budgets", urgency: 3 });
  }

  for (const g of goals) {
    if (g.targetMinor > 0 && g.currentMinor >= g.targetMinor) out.push({ text: `Goal reached: ${g.name} 🎉`, tone: "positive", href: "/goals", urgency: 5 });
  }

  return out.sort((a, b) => a.urgency - b.urgency).slice(0, 20);
}
