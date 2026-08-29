import { Receipt } from "lucide-react";
import { getCurrentUser } from "@/lib/user";
import { getTransactions } from "@/lib/queries";
import { rupeesToPaise } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { TransactionFilters } from "@/components/transaction-filters";
import { TransactionList } from "@/components/transaction-list";

export const dynamic = "force-dynamic";

function paiseOrUndef(v?: string): number | undefined {
  if (!v) return undefined;
  try {
    return rupeesToPaise(v);
  } catch {
    return undefined;
  }
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const { accounts, categories, txns } = await getTransactions(user.id, {
    q: str(sp.q),
    accountId: str(sp.accountId),
    categoryId: str(sp.categoryId),
    type: str(sp.type),
    minMinor: paiseOrUndef(str(sp.min)),
    maxMinor: paiseOrUndef(str(sp.max)),
    from: str(sp.from),
    to: str(sp.to),
    recurring: str(sp.recurring) === "1",
  });

  const catByParent = (() => {
    const byId = new Map(categories.map((c) => [c.id, c]));
    return categories
      .map((c) => ({ id: c.id, name: c.parentId ? `${byId.get(c.parentId)?.name ?? ""} / ${c.name}` : c.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  })();

  const acctOpts = accounts.map((a) => ({ id: a.id, name: a.name, type: a.type, icon: a.icon }));
  const catOpts = categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind, parentId: c.parentId }));

  return (
    <div className="space-y-5">
      <PageHeader title="Transactions" subtitle="Search and filter everything you’ve recorded." />

      <TransactionFilters accounts={accounts.map((a) => ({ id: a.id, name: a.name }))} categories={catByParent} />

      <Card>
        <CardContent className="pt-5">
          {txns.length === 0 ? (
            <EmptyState
              icon={<Receipt className="size-8" />}
              title="No transactions found"
              description="Try clearing filters, or add your first expense or income with the “+ Add” button above."
            />
          ) : (
            <>
              <p className="mb-2 text-xs text-muted-foreground">{txns.length} transaction{txns.length === 1 ? "" : "s"}</p>
              <TransactionList items={txns} accounts={acctOpts} categories={catOpts} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
