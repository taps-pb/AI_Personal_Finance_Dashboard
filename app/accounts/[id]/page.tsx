import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/user";
import { getAccountDetail } from "@/lib/queries";
import { prisma } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { accountKind } from "@/lib/constants";
import { creditUtilization, investmentReturn } from "@/lib/finance/metrics";
import { StatCard } from "@/components/stat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { TransactionList } from "@/components/transaction-list";
import { BalanceHistoryChart, InOutChart } from "@/components/charts";
import { UpdateBalanceButton } from "@/components/account-actions";

export const dynamic = "force-dynamic";

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const data = await getAccountDetail(user.id, id);
  if (!data) notFound();

  const { account: a, moneyInMinor, moneyOutMinor, history, txns, categoryBreakdown, monthly } = data;
  const [accountsRaw, categoriesRaw] = await Promise.all([
    prisma.account.findMany({ where: { userId: user.id, status: "active" }, orderBy: { createdAt: "asc" } }),
    prisma.category.findMany({ where: { userId: user.id } }),
  ]);
  const acctOpts = accountsRaw.map((x) => ({ id: x.id, name: x.name, type: x.type, icon: x.icon }));
  const catOpts = categoriesRaw.map((c) => ({ id: c.id, name: c.name, kind: c.kind, parentId: c.parentId }));
  const liability = accountKind(a.type) === "liability";
  const util = a.type === "Credit Card" && a.creditLimitMinor ? creditUtilization(a.balanceMinor, a.creditLimitMinor) : null;
  const pl = a.investedMinor != null ? investmentReturn(a.balanceMinor, a.investedMinor) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/accounts" className="text-muted-foreground hover:text-foreground" aria-label="Back to accounts">
            <ArrowLeft className="size-5" />
          </Link>
          <span className="flex size-10 items-center justify-center rounded-full bg-muted text-lg">{a.icon ?? "🏦"}</span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{a.name}</h1>
            <p className="text-sm text-muted-foreground">{a.institution ? `${a.type} · ${a.institution}` : a.type}</p>
          </div>
        </div>
        <UpdateBalanceButton accountId={a.id} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={liability ? "Outstanding" : "Current balance"} value={formatINR(a.balanceMinor)} tone={liability ? "negative" : "primary"} />
        <StatCard label="Money in" value={formatINR(moneyInMinor)} tone="positive" />
        <StatCard label="Money out" value={formatINR(moneyOutMinor)} tone="negative" />
        {util !== null ? (
          <StatCard label="Utilization" value={`${util.toFixed(0)}%`} tone={util >= 70 ? "negative" : "default"} sub={a.creditLimitMinor ? `Available ${formatINR(a.creditLimitMinor - a.balanceMinor)}` : undefined} />
        ) : pl ? (
          <StatCard label="Profit / loss" value={formatINR(pl.plMinor)} tone={pl.plMinor >= 0 ? "positive" : "negative"} sub={`${pl.plPct.toFixed(1)}% · invested ${formatINR(a.investedMinor ?? 0)}`} />
        ) : (
          <StatCard label="Last updated" value={new Date(a.updatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} />
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Balance history</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length < 2 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Not enough history yet. Update the balance to build a chart.</p>
          ) : (
            <BalanceHistoryChart data={history} />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Monthly activity</CardTitle>
          </CardHeader>
          <CardContent>
            <InOutChart data={monthly} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Spending by category</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryBreakdown.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No categorized spending from this account yet.</p>
            ) : (
              <ul className="space-y-2">
                {categoryBreakdown.map((c) => (
                  <li key={c.name} className="flex items-center gap-2 text-sm">
                    <span className="size-2.5 rounded-full" style={{ background: c.color }} />
                    <span className="truncate">{c.name}</span>
                    <span className="ml-auto font-medium tabular">{formatINR(c.amountMinor)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {txns.length === 0 ? (
            <EmptyState title="No transactions" description="Transactions involving this account will appear here." />
          ) : (
            <TransactionList
              showAccount={false}
              accounts={acctOpts}
              categories={catOpts}
              items={txns.map((t) => ({
                id: t.id,
                type: t.type,
                name: t.name,
                amountMinor: t.amountMinor,
                date: t.date,
                categoryName: t.categoryName,
                merchant: t.merchant,
                accountId: t.accountId,
                toAccountId: t.toAccountId,
                categoryId: t.categoryId,
                feeMinor: t.feeMinor,
                paymentMethod: t.paymentMethod,
                description: t.description,
              }))}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
