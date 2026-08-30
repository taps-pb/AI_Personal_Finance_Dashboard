import { getCurrentUser } from "@/lib/user";
import { getBudgetsData } from "@/lib/queries-p3";
import { PageHeader } from "@/components/page-header";
import { BudgetManager } from "@/components/budget-manager";

export const dynamic = "force-dynamic";

export default async function BudgetsPage() {
  const user = await getCurrentUser();
  const data = await getBudgetsData(user.id);

  return (
    <div className="space-y-6">
      <PageHeader title="Budgets" subtitle="Monthly spending limits, overall or per category." />
      <BudgetManager rows={data.rows} availableCategories={data.availableCategories} hasOverall={data.hasOverall} />
    </div>
  );
}
