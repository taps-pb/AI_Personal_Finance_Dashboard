import { getCurrentUser } from "@/lib/user";
import { getAnalytics } from "@/lib/analytics";
import { ensureTodaySnapshot } from "@/lib/snapshot";
import type { RangeKey } from "@/lib/ranges";
import { formatINR, compactINR } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { RangeSelector } from "@/components/range-selector";
import { StatCard } from "@/components/stat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IncomeExpenseChart, NetWorthChart, CategoryDonut } from "@/components/charts";

export const dynamic = "force-dynamic";

function Change({ pct, goodWhenDown = false }: { pct: number | null; goodWhenDown?: boolean }) {
  if (pct === null) return <span className="text-muted-foreground">no prior data</span>;
  const up = pct > 0;
  const good = goodWhenDown ? !up : up;
  return (
    <span className={good ? "text-[var(--success)]" : "text-destructive"}>
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  await ensureTodaySnapshot(user.id);
  const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const range = (str(sp.range) as RangeKey) ?? "30d";
  const a = await getAnalytics(user.id, { range, from: str(sp.from), to: str(sp.to) });

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" subtitle="Trends, comparisons and breakdowns across a time range." />
      <RangeSelector />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Spending" value={formatINR(a.spending)} tone="negative" sub={a.hasPrev ? <>vs prev <Change pct={a.spendingChangePct} goodWhenDown /></> : `${a.txnCount} transactions`} />
        <StatCard label="Income" value={formatINR(a.income)} tone="positive" sub={a.hasPrev ? <>vs prev <Change pct={a.incomeChangePct} /></> : undefined} />
        <StatCard label="Net cash flow" value={formatINR(a.cashFlowMinor)} tone={a.cashFlowMinor >= 0 ? "positive" : "negative"} />
        <StatCard label="Savings rate" value={`${a.savingsRatePct.toFixed(0)}%`} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Avg daily spend" value={formatINR(a.avgDailySpendMinor)} />
        <StatCard label="Avg transaction" value={formatINR(a.avgTxnSizeMinor)} />
        <StatCard label="Transactions" value={String(a.txnCount)} />
        <StatCard label="Subscriptions" value={`${compactINR(a.subscriptionMonthlyMinor)}/mo`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Spending vs income</CardTitle>
        </CardHeader>
        <CardContent>
          {a.trend.every((t) => t.spendingMinor === 0 && t.incomeMinor === 0) ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No activity in this range.</p>
          ) : (
            <IncomeExpenseChart data={a.trend} />
          )}
        </CardContent>
      </Card>

      {range === "this" && a.forecast && (
        <Card>
          <CardHeader>
            <CardTitle>Month-end forecast</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard label="Expected spending" value={formatINR(a.forecast.expectedSpendingMinor)} tone="negative" />
              <StatCard label="Known upcoming" value={formatINR(a.forecast.upcomingKnownMinor)} sub="subscriptions + recurring" />
              <StatCard label="Days remaining" value={String(a.forecast.daysRemaining)} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Estimate — extrapolates your spend-so-far and adds known upcoming charges. Not a guarantee.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Net worth movement</CardTitle>
          </CardHeader>
          <CardContent>
            {a.nwSeries.length < 2 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Not enough snapshots yet. Net worth is recorded as you use the app.</p>
            ) : (
              <>
                <NetWorthChart data={a.nwSeries} />
                {a.netWorthMovement && (
                  <p className="mt-2 text-sm">
                    {formatINR(a.netWorthMovement.startMinor)} → <span className="font-medium">{formatINR(a.netWorthMovement.endMinor)}</span>{" "}
                    <span className={a.netWorthMovement.changeMinor >= 0 ? "text-[var(--success)]" : "text-destructive"}>
                      ({a.netWorthMovement.changeMinor >= 0 ? "+" : ""}
                      {formatINR(a.netWorthMovement.changeMinor)})
                    </span>
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Spending by category</CardTitle>
          </CardHeader>
          <CardContent>
            {a.categoryBreakdown.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No spending in this range.</p>
            ) : (
              <div className="grid items-center gap-4 sm:grid-cols-2">
                <CategoryDonut data={a.categoryBreakdown.slice(0, 8)} />
                <ul className="space-y-2">
                  {a.categoryBreakdown.slice(0, 6).map((c) => (
                    <li key={c.id} className="flex items-center gap-2 text-sm">
                      <span className="size-2.5 rounded-full" style={{ background: c.color }} />
                      <span className="truncate">{c.name}</span>
                      <span className="ml-auto font-medium tabular">{formatINR(c.amountMinor)}</span>
                      {a.hasPrev && <span className="w-16 text-right text-xs"><Change pct={c.changePct} goodWhenDown /></span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top merchants</CardTitle>
          </CardHeader>
          <CardContent>
            {a.merchantBreakdown.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No merchant data in this range.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="pb-2 font-medium">Merchant</th>
                      <th className="pb-2 text-right font-medium">Total</th>
                      <th className="pb-2 text-right font-medium">Txns</th>
                      <th className="pb-2 text-right font-medium">Avg</th>
                      <th className="pb-2 text-right font-medium">Last</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.merchantBreakdown.map((m) => (
                      <tr key={m.merchant} className="border-t border-border">
                        <td className="py-2">{m.merchant}</td>
                        <td className="py-2 text-right font-medium tabular">{formatINR(m.totalMinor)}</td>
                        <td className="py-2 text-right tabular text-muted-foreground">{m.count}</td>
                        <td className="py-2 text-right tabular text-muted-foreground">{formatINR(m.avgMinor)}</td>
                        <td className="py-2 text-right text-muted-foreground">{fmtDate(m.lastISO)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account usage & largest expenses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {a.accountUsage.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Spending by account</p>
                <ul className="space-y-2">
                  {a.accountUsage.slice(0, 5).map((acc) => (
                    <li key={acc.id} className="flex items-center gap-2 text-sm">
                      <span className="size-2.5 rounded-full" style={{ background: acc.color }} />
                      <span className="truncate">{acc.name}</span>
                      <span className="ml-auto font-medium tabular">{formatINR(acc.amountMinor)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {a.largestExpenses.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Largest expenses</p>
                <ul className="space-y-2">
                  {a.largestExpenses.map((e, i) => (
                    <li key={e.id} className="flex items-center gap-2 text-sm">
                      <Badge>{i + 1}</Badge>
                      <span className="truncate">{e.name}</span>
                      {e.categoryName && <span className="truncate text-xs text-muted-foreground">· {e.categoryName}</span>}
                      <span className="ml-auto font-medium tabular">{formatINR(e.amountMinor)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {a.accountUsage.length === 0 && a.largestExpenses.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">No spending in this range.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
