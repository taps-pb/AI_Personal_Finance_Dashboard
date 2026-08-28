import Link from "next/link";
import { getCurrentUser } from "@/lib/user";
import { getAccounts } from "@/lib/queries";
import { formatINR, compactINR } from "@/lib/money";
import { accountKind } from "@/lib/constants";
import { netWorth, totalAssets, totalLiabilities } from "@/lib/finance/networth";
import { creditUtilization } from "@/lib/finance/metrics";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/stat";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { AddAccountButton, AccountRowMenu } from "@/components/account-actions";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const user = await getCurrentUser();
  const accounts = await getAccounts(user.id);
  const active = accounts.filter((a) => a.status !== "archived");
  const archived = accounts.filter((a) => a.status === "archived");

  return (
    <div className="space-y-6">
      <PageHeader title="Accounts" subtitle="Everywhere your money is stored or owed." action={<AddAccountButton />} />

      {accounts.length === 0 ? (
        <EmptyState title="No accounts yet" description="Add your first account to start tracking balances and net worth." action={<AddAccountButton />} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label="Net worth" value={formatINR(netWorth(accounts))} tone="primary" />
            <StatCard label="Total assets" value={compactINR(totalAssets(accounts))} tone="positive" />
            <StatCard label="Total liabilities" value={compactINR(totalLiabilities(accounts))} tone="negative" />
          </div>

          <AccountGrid accounts={active} />

          {archived.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">Archived</h2>
              <AccountGrid accounts={archived} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AccountGrid({ accounts }: { accounts: Awaited<ReturnType<typeof getAccounts>> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {accounts.map((a) => {
        const liability = accountKind(a.type) === "liability";
        const util = a.type === "Credit Card" && a.creditLimitMinor ? creditUtilization(a.balanceMinor, a.creditLimitMinor) : null;
        return (
          <Card key={a.id} className="p-4">
            <div className="flex items-start gap-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-muted text-base">{a.icon ?? "🏦"}</span>
              <div className="min-w-0 flex-1">
                <Link href={`/accounts/${a.id}`} className="truncate font-medium hover:underline">
                  {a.name}
                </Link>
                <p className="truncate text-xs text-muted-foreground">{a.institution ? `${a.type} · ${a.institution}` : a.type}</p>
              </div>
              <AccountRowMenu account={serialize(a)} />
            </div>
            <p className={`mt-3 text-xl font-semibold tabular ${liability ? "text-destructive" : ""}`}>{formatINR(a.balanceMinor)}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {liability && <Badge variant="destructive">Owed</Badge>}
              {!a.includeInNetWorth && <Badge variant="outline">Excluded from net worth</Badge>}
              {a.investedMinor != null && (
                <Badge variant={a.balanceMinor - a.investedMinor >= 0 ? "success" : "destructive"}>
                  {a.balanceMinor - a.investedMinor >= 0 ? "▲" : "▼"} {formatINR(Math.abs(a.balanceMinor - a.investedMinor))}
                </Badge>
              )}
            </div>
            {util !== null && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Utilization</span>
                  <span className={util >= 70 ? "text-destructive" : ""}>{util.toFixed(0)}%</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${util >= 70 ? "bg-destructive" : "bg-primary"}`}
                    style={{ width: `${Math.min(util, 100)}%` }}
                  />
                </div>
                {a.creditLimitMinor && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Available {formatINR(a.creditLimitMinor - a.balanceMinor)} of {formatINR(a.creditLimitMinor)}
                  </p>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function serialize(a: Awaited<ReturnType<typeof getAccounts>>[number]) {
  return {
    id: a.id,
    name: a.name,
    type: a.type,
    institution: a.institution,
    balanceMinor: a.balanceMinor,
    includeInNetWorth: a.includeInNetWorth,
    icon: a.icon,
    color: a.color,
    creditLimitMinor: a.creditLimitMinor,
    statementDay: a.statementDay,
    dueDay: a.dueDay,
    investedMinor: a.investedMinor,
    status: a.status,
  };
}
