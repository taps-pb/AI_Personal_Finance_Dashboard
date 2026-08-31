// Deterministic, READ-ONLY tools the AI assistant may call (spec §15). The LLM
// never touches the database directly — it can only request these structured
// summaries, which keeps its answers grounded in real data and safe.
import { prisma } from "@/lib/db";
import { getDashboardData, getTransactions } from "@/lib/queries";
import { getSubscriptionsData, getBudgetsData, getRecurringData, getGoalsData } from "@/lib/queries-p3";
import { getAnalytics } from "@/lib/analytics";
import { getNetWorthSnapshots } from "@/lib/snapshot";
import { accountKind } from "@/lib/constants";
import type { RangeKey } from "@/lib/ranges";

const rup = (paise: number) => Math.round(paise) / 100;
const RANGES: RangeKey[] = ["7d", "30d", "this", "last", "3m", "6m", "1y", "all"];
const asRange = (v: unknown): RangeKey => (RANGES.includes(v as RangeKey) ? (v as RangeKey) : "this");

export const AI_TOOLS = [
  { name: "get_financial_summary", description: "Overall snapshot: net worth, assets/liabilities, liquid, investments, cash, credit outstanding, and this month's income, spending, cash flow, savings rate and subscription cost. Call this first for broad questions.", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "get_accounts", description: "List all accounts with balances, type (asset/liability) and whether they count toward net worth.", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "get_monthly_spending", description: "Income, spending, cash flow and savings rate for a period, with % change vs the previous equal period.", input_schema: { type: "object", properties: { range: { type: "string", enum: RANGES, description: "Defaults to 'this' (current month)." } }, additionalProperties: false } },
  { name: "get_category_breakdown", description: "Spending grouped by category for a period, with % change vs the previous period. Use for 'what did I spend most on' and category comparisons.", input_schema: { type: "object", properties: { range: { type: "string", enum: RANGES } }, additionalProperties: false } },
  { name: "get_subscriptions", description: "Active subscriptions, monthly and annual cost, upcoming renewals and cost by category.", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "get_upcoming_payments", description: "Payments due in the next 30 days: subscription renewals, recurring transactions and credit-card dues.", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "get_net_worth_history", description: "Net-worth snapshots over time (date + net worth).", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "get_budget_status", description: "Each budget with its limit, spent, percent used and status (normal/approaching/warning/exceeded).", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "get_goals", description: "Savings goals with progress, remaining amount and required monthly contribution.", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "get_transactions", description: "Recent transactions, optionally filtered. Use for 'show my Zomato transactions' or 'expenses above 5000'.", input_schema: { type: "object", properties: { query: { type: "string", description: "Text match on name/merchant/notes." }, minAmount: { type: "number", description: "Minimum amount in rupees." }, maxAmount: { type: "number", description: "Maximum amount in rupees." }, type: { type: "string", description: "EXPENSE, INCOME, TRANSFER, etc." }, limit: { type: "number", description: "Max rows (default 20)." } }, additionalProperties: false } },
] as const;

type Input = Record<string, unknown>;

export async function runTool(name: string, input: Input, userId: string): Promise<unknown> {
  switch (name) {
    case "get_financial_summary": {
      const d = await getDashboardData(userId);
      return {
        netWorth: rup(d.netWorthMinor),
        totalAssets: rup(d.totalAssetsMinor),
        totalLiabilities: rup(d.totalLiabilitiesMinor),
        liquid: rup(d.liquidMinor),
        investments: rup(d.investmentsMinor),
        cash: rup(d.cashMinor),
        creditOutstanding: rup(d.creditOutstandingMinor),
        thisMonth: { income: rup(d.incomeMinor), spending: rup(d.spendingMinor), cashFlow: rup(d.cashFlowMinor), savingsRatePct: Math.round(d.savingsRatePct), transactions: d.txnCount },
        subscriptionsPerMonth: rup(d.subscriptionMonthlyMinor),
        currency: "INR",
      };
    }
    case "get_accounts": {
      const accounts = await prisma.account.findMany({ where: { userId } });
      return accounts.map((a) => ({ name: a.name, type: a.type, kind: accountKind(a.type), institution: a.institution, balance: rup(a.balanceMinor), includeInNetWorth: a.includeInNetWorth, status: a.status }));
    }
    case "get_monthly_spending": {
      const a = await getAnalytics(userId, { range: asRange(input.range) });
      return { range: a.range, income: rup(a.income), spending: rup(a.spending), cashFlow: rup(a.cashFlowMinor), savingsRatePct: Math.round(a.savingsRatePct), spendingChangePct: a.spendingChangePct == null ? null : Math.round(a.spendingChangePct), previousSpending: rup(a.prevSpendingMinor), avgDailySpend: rup(a.avgDailySpendMinor) };
    }
    case "get_category_breakdown": {
      const a = await getAnalytics(userId, { range: asRange(input.range) });
      return { range: a.range, categories: a.categoryBreakdown.slice(0, 12).map((c) => ({ name: c.name, amount: rup(c.amountMinor), changePct: c.changePct == null ? null : Math.round(c.changePct) })) };
    }
    case "get_subscriptions": {
      const s = await getSubscriptionsData(userId);
      return {
        activeCount: s.activeCount,
        perMonth: rup(s.monthlyMinor),
        perYear: rup(s.annualMinor),
        renewingIn30Days: { count: s.d30.count, amount: rup(s.d30.amountMinor) },
        upcoming: s.upcoming.slice(0, 15).map((x) => ({ name: x.name, amount: rup(x.amountMinor), inDays: x.daysUntil, account: x.accountName })),
        byCategory: s.byCategory.map((c) => ({ name: c.name, perMonth: rup(c.amountMinor) })),
        mostExpensive: s.mostExpensive ? { name: s.mostExpensive.name, perMonth: rup(s.mostExpensive.monthlyMinor) } : null,
      };
    }
    case "get_upcoming_payments": {
      const [d, recs] = await Promise.all([getDashboardData(userId), getRecurringData(userId)]);
      return {
        subscriptions: d.upcomingSubscriptions.map((s) => ({ name: s.name, amount: rup(s.amountMinor), inDays: s.daysUntil, account: s.accountName })),
        creditCardDue: d.creditCardDue.map((c) => ({ name: c.name, outstanding: rup(c.outstandingMinor), inDays: c.daysUntil })),
        recurring: recs.filter((r) => r.daysUntil <= 30).map((r) => ({ name: r.name, type: r.type, amount: rup(r.amountMinor), inDays: r.daysUntil })),
      };
    }
    case "get_net_worth_history": {
      const snaps = await getNetWorthSnapshots(userId);
      return snaps.map((s) => ({ date: s.date.toISOString().slice(0, 10), netWorth: rup(s.netWorthMinor), assets: rup(s.totalAssetsMinor), liabilities: rup(s.totalLiabilitiesMinor) }));
    }
    case "get_budget_status": {
      const b = await getBudgetsData(userId);
      return b.rows.map((x) => ({ name: x.name, limit: rup(x.amountMinor), spent: rup(x.spentMinor), percentUsed: Math.round(x.pct), status: x.status, remaining: rup(x.remainingMinor), projectedMonthEnd: rup(x.projectedMinor) }));
    }
    case "get_goals": {
      const g = await getGoalsData(userId);
      return g.map((x) => ({ name: x.name, target: rup(x.targetMinor), saved: rup(x.currentMinor), percent: Math.round(x.pct), remaining: rup(x.remainingMinor), monthlyNeeded: x.monthlyRequiredMinor == null ? null : rup(x.monthlyRequiredMinor), targetDate: x.targetISO ? x.targetISO.slice(0, 10) : null, reached: x.reached }));
    }
    case "get_transactions": {
      const limit = typeof input.limit === "number" ? Math.min(input.limit, 50) : 20;
      const { txns } = await getTransactions(userId, {
        q: typeof input.query === "string" ? input.query : undefined,
        type: typeof input.type === "string" ? input.type : undefined,
        minMinor: typeof input.minAmount === "number" ? Math.round(input.minAmount * 100) : undefined,
        maxMinor: typeof input.maxAmount === "number" ? Math.round(input.maxAmount * 100) : undefined,
      });
      return txns.slice(0, limit).map((t) => ({ date: t.date.slice(0, 10), name: t.name, type: t.type, amount: rup(t.amountMinor), account: t.accountName, category: t.categoryName, merchant: t.merchant }));
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
