import { getCurrentUser } from "@/lib/user";
import { prisma } from "@/lib/db";
import { getGoalsData } from "@/lib/queries-p3";
import { PageHeader } from "@/components/page-header";
import { GoalsManager } from "@/components/goals-manager";

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const user = await getCurrentUser();
  const [rows, accounts] = await Promise.all([
    getGoalsData(user.id),
    prisma.account.findMany({ where: { userId: user.id, status: "active" }, orderBy: { createdAt: "asc" } }),
  ]);
  const acctOpts = accounts.map((a) => ({ id: a.id, name: a.name, type: a.type, icon: a.icon }));

  return (
    <div className="space-y-6">
      <PageHeader title="Goals" subtitle="Track progress toward what you’re saving for." />
      <GoalsManager rows={rows} accounts={acctOpts} />
    </div>
  );
}
