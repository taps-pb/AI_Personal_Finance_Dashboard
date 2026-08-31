import Link from "next/link";
import { Wallet } from "lucide-react";
import { getCurrentUser } from "@/lib/user";
import { getDashboardData, getAccounts } from "@/lib/queries";
import { ensureTodaySnapshot } from "@/lib/snapshot";
import { getInsights } from "@/lib/insights";
import { AIInsights } from "@/components/ai-insights";
import { formatINR, compactINR } from "@/lib/money";
import { accountKind } from "@/lib/constants";
import { StatCard } from "@/components/stat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { TransactionList } from "@/components/transaction-list";
import { NetWorthChart, IncomeExpenseChart, CategoryDonut } from "@/components/charts";
import { PageHeader } from "@/components/page-header";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  await ensureTodaySnapshot(user.id);
  const [d, accounts, insights] = await Promise.all([getDashboardData(user.id), getAccounts(user.id), getInsights(user.id)]);
  const activeAccounts = accounts.filter((a) => a.status !== "archived");

  if (activeAccounts.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" subtitle="Your financial overview." />
        <EmptyState
          icon={<Wallet className="size-8" />}
          title="No accounts yet"
          description="Add your first account with the “+ Add” button above to start tracking your money."
        />
      </div>
    );
  }

  const now = new Date();
  const monthName = now.toLocaleDateString("en-IN", { month: "long" });
  const spendDelta =
    d.lastMonthSpendingMinor > 0
      ? ((d.spendingMinor - d.lastMonthSpendingMinor) / d.lastMonthSpendingMinor) * 100
      : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle={`Your financial overview · ${monthName}`} />

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Net worth" value={formatINR(d.netWorthMinor)} tone="primary" sub={`Assets ${compactINR(d.totalAssetsMinor)} · Liabilities ${compactINR(d.totalLiabilitiesMinor)}`} />
        <StatCard
          label={`Spending · ${monthName}`}
          value={formatINR(d.spendingMinor)}
          tone="negative"
          sub={
            spendDelta === null ? (
              `${d.txnCount} transactions`
            ) : (
              <span className={spendDelta > 0 ? "text-destructive" : "text-[var(--success)]"}>
                {spendDelta > 0 ? "▲" : "▼"} {Math.abs(spendDelta).toFixed(1)}% vs last month
              </span>
            )
          }
        />
        <StatCard label={`Income · ${monthName}`} value={formatINR(d.incomeMinor)} tone="positive" sub={`Savings rate ${d.savingsRatePct.toFixed(0)}%`} />
        <StatCard
          label="Net cash flow"
          value={formatINR(d.cashFlowMinor)}
          tone={d.cashFlowMinor >= 0 ? "positive" : "negative"}
          sub={d.cashFlowMinor >= 0 ? "Income exceeds spending" : "Spending exceeds income"}
        />
      </div>

      {/* Secondary buckets */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Liquid" value={compactINR(d.liquidMinor)} />
        <StatCard label="Investments" value={compactINR(d.investmentsMinor)} />
        <StatCard label="Cash" value={compactINR(d.cashMinor)} />
        <StatCard label="Credit outstanding" value={compactINR(d.creditOutstandingMinor)} tone={d.creditOutstandingMinor > 0 ? "negative" : "default"} />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Net worth over time</CardTitle>
          </CardHeader>
          <CardContent>
            <NetWorthChart data={d.netWorthSeries} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Income vs spending</CardTitle>
          </CardHeader>
          <CardContent>
            <IncomeExpenseChart data={d.incomeExpenseSeries} />
          </CardContent>
        </Card>
      </div>

      {/* Category + accounts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Spending by category · {monthName}</CardTitle>
          </CardHeader>
          <CardContent>
            {d.categoryBreakdown.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No spending recorded this month yet.</p>
            ) : (
              <div className="grid items-center gap-4 sm:grid-cols-2">
                <CategoryDonut data={d.categoryBreakdown.slice(0, 8)} />
                <ul className="space-y-2">
                  {d.categoryBreakdown.slice(0, 6).map((c) => (
                    <li key={c.id} className="flex items-center gap-2 text-sm">
                      <span className="size-2.5 rounded-full" style={{ background: c.color }} />
                      <span className="truncate">{c.name}</span>
                      <span className="ml-auto font-medium tabular">{formatINR(c.amountMinor)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Accounts</CardTitle>
            <Link href="/accounts" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-1">
            {activeAccounts.slice(0, 6).map((a) => (
              <Link key={a.id} href={`/accounts/${a.id}`} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent">
                <span className="flex size-8 items-center justify-center rounded-full bg-muted text-sm">{a.icon ?? "🏦"}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.type}</p>
                </div>
                <span className={`ml-auto text-sm font-semibold tabular ${accountKind(a.type) === "liability" ? "text-destructive" : ""}`}>
                  {formatINR(a.balanceMinor)}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming subscriptions + credit-card due */}
      {(d.upcomingSubscriptions.length > 0 || d.creditCardDue.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Upcoming subscriptions</CardTitle>
              <Link href="/subscriptions" className="text-xs text-primary hover:underline">
                Manage
              </Link>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-xs text-muted-foreground">
                About <span className="font-medium text-foreground">{formatINR(d.subscriptionMonthlyMinor)}/month</span> on subscriptions.
              </p>
              {d.upcomingSubscriptions.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">Nothing renewing in the next 30 days.</p>
              ) : (
                <ul className="space-y-2">
                  {d.upcomingSubscriptions.map((s) => (
                    <li key={s.id} className="flex items-center gap-2 text-sm">
                      <span className="truncate">{s.name}</span>
                      {s.accountName && <span className="truncate text-xs text-muted-foreground">· {s.accountName}</span>}
                      <span className="ml-auto text-xs text-muted-foreground">{daysLabel(s.daysUntil)}</span>
                      <span className="w-20 text-right font-medium tabular">{formatINR(s.amountMinor)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {d.creditCardDue.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Credit-card payments due</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {d.creditCardDue.map((c) => (
                    <li key={c.id} className="flex items-center gap-2 text-sm">
                      <span className="truncate">{c.name}</span>
                      <span className={`ml-auto text-xs ${c.daysUntil <= 3 ? "text-destructive" : "text-muted-foreground"}`}>{daysLabel(c.daysUntil)}</span>
                      <span className="w-24 text-right font-medium tabular">{formatINR(c.outstandingMinor)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Recent + largest */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent transactions</CardTitle>
            <Link href="/transactions" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {d.recent.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No transactions yet.</p>
            ) : (
              <TransactionList items={d.recent} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Largest expenses · {monthName}</CardTitle>
          </CardHeader>
          <CardContent>
            {d.largestExpenses.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No expenses this month yet.</p>
            ) : (
              <ul className="space-y-3">
                {d.largestExpenses.map((e, i) => (
                  <li key={e.id} className="flex items-center gap-3">
                    <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-medium">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{e.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[e.categoryName, e.accountName].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <span className="ml-auto text-sm font-semibold tabular">{formatINR(e.amountMinor)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <AIInsights insights={insights} />
    </div>
  );
}

function daysLabel(d: number): string {
  if (d < 0) return `${-d}d overdue`;
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  return `in ${d}d`;
}

export const dynamic = "force-dynamic";
