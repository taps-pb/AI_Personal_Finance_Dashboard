import { getCurrentUser } from "@/lib/user";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { CategoryManager } from "@/components/category-manager";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const user = await getCurrentUser();
  const categories = await prisma.category.findMany({
    where: { userId: user.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true, kind: true, parentId: true, icon: true, color: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Categories" subtitle="Organize spending and income. Add, rename, or remove categories and subcategories." />
      <CategoryManager categories={categories} />
    </div>
  );
}
