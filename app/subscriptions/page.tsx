import { getCurrentUser } from "@/lib/user";
import { prisma } from "@/lib/db";
import { getSubscriptionsData, getRecurringData } from "@/lib/queries-p3";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SubscriptionsManager } from "@/components/subscriptions-manager";
import { RecurringManager } from "@/components/recurring-manager";

export const dynamic = "force-dynamic";

export default async function SubscriptionsPage() {
  const user = await getCurrentUser();
  const [subs, recurring, accounts, categories] = await Promise.all([
    getSubscriptionsData(user.id),
    getRecurringData(user.id),
    prisma.account.findMany({ where: { userId: user.id, status: "active" }, orderBy: { createdAt: "asc" } }),
    prisma.category.findMany({ where: { userId: user.id } }),
  ]);
  const acctOpts = accounts.map((a) => ({ id: a.id, name: a.name, type: a.type, icon: a.icon }));
  const catOpts = categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind, parentId: c.parentId }));

  const summary = {
    monthlyMinor: subs.monthlyMinor,
    annualMinor: subs.annualMinor,
    activeCount: subs.activeCount,
    d7: subs.d7,
    d30: subs.d30,
    d90: subs.d90,
    byCategory: subs.byCategory,
    mostExpensive: subs.mostExpensive,
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Subscriptions & recurring" subtitle="What you pay for on a schedule." />
      <Tabs defaultValue="subscriptions">
        <TabsList>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="recurring">Recurring</TabsTrigger>
        </TabsList>
        <TabsContent value="subscriptions">
          <SubscriptionsManager rows={subs.rows} summary={summary} accounts={acctOpts} categories={catOpts} />
        </TabsContent>
        <TabsContent value="recurring">
          <RecurringManager rows={recurring} accounts={acctOpts} categories={catOpts} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
