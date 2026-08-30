"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/user";
import { writeAudit } from "@/lib/audit";
import { budgetSchema, type ActionResult } from "@/lib/validation";

function revalidateAll() {
  revalidatePath("/budgets");
  revalidatePath("/");
}

function firstError(e: { issues: { message: string }[] }): string {
  return e.issues[0]?.message ?? "Invalid input";
}

/** Set (create or update) a category budget, or the overall budget (no category). */
export async function upsertBudget(raw: unknown): Promise<ActionResult> {
  const parsed = budgetSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  try {
    const user = await getCurrentUser();
    const categoryId = d.categoryId ?? null;
    const existing = await prisma.budget.findFirst({ where: { userId: user.id, categoryId } });
    if (existing) {
      await prisma.budget.update({ where: { id: existing.id }, data: { amountMinor: d.amount } });
    } else {
      await prisma.budget.create({ data: { userId: user.id, categoryId, amountMinor: d.amount } });
    }
    await writeAudit(prisma, { userId: user.id, action: "budget.upsert", entity: "Budget", entityId: categoryId ?? "overall", after: { amountMinor: d.amount } });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteBudget(id: string): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    await prisma.budget.delete({ where: { id } });
    await writeAudit(prisma, { userId: user.id, action: "budget.delete", entity: "Budget", entityId: id });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
