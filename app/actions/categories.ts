"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/user";
import { writeAudit } from "@/lib/audit";
import { categorySchema, type ActionResult } from "@/lib/validation";

function revalidateAll() {
  revalidatePath("/categories");
  revalidatePath("/transactions");
  revalidatePath("/");
}

function firstError(e: { issues: { message: string }[] }): string {
  return e.issues[0]?.message ?? "Invalid input";
}

export async function createCategory(raw: unknown): Promise<ActionResult> {
  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  try {
    const user = await getCurrentUser();
    // A subcategory inherits its parent's kind.
    let kind = d.kind;
    if (d.parentId) {
      const parent = await prisma.category.findFirst({ where: { id: d.parentId, userId: user.id } });
      if (!parent) return { ok: false, error: "Parent category not found" };
      if (parent.parentId) return { ok: false, error: "Categories can only nest one level deep" };
      kind = parent.kind as "expense" | "income";
    }
    const cat = await prisma.category.create({
      data: { userId: user.id, name: d.name, kind, parentId: d.parentId ?? null, icon: d.icon ?? null, color: d.color ?? null },
    });
    await writeAudit(prisma, { userId: user.id, action: "category.create", entity: "Category", entityId: cat.id, after: { name: d.name, kind } });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function updateCategory(id: string, raw: unknown): Promise<ActionResult> {
  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  try {
    const user = await getCurrentUser();
    await prisma.category.update({
      where: { id },
      data: { name: d.name, icon: d.icon ?? null, color: d.color ?? null },
    });
    await writeAudit(prisma, { userId: user.id, action: "category.update", entity: "Category", entityId: id, after: { name: d.name } });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Delete a category. Transactions are not destroyed — they become uncategorized.
 * Subcategories are promoted to top-level so their history survives too.
 */
export async function deleteCategory(id: string): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    await prisma.$transaction(async (tx) => {
      const children = await tx.category.findMany({ where: { parentId: id }, select: { id: true } });
      const ids = [id, ...children.map((c) => c.id)];
      await tx.transaction.updateMany({ where: { categoryId: { in: ids } }, data: { categoryId: null } });
      await tx.category.updateMany({ where: { parentId: id }, data: { parentId: null } });
      await tx.category.delete({ where: { id } });
      await writeAudit(tx, { userId: user.id, action: "category.delete", entity: "Category", entityId: id });
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
