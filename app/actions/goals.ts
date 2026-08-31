"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/user";
import { writeAudit } from "@/lib/audit";
import { goalSchema, contributeSchema, type ActionResult } from "@/lib/validation";

function revalidateAll() {
  revalidatePath("/goals");
  revalidatePath("/");
}

function firstError(e: { issues: { message: string }[] }): string {
  return e.issues[0]?.message ?? "Invalid input";
}

export async function createGoal(raw: unknown): Promise<ActionResult> {
  const parsed = goalSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  try {
    const user = await getCurrentUser();
    const goal = await prisma.savingsGoal.create({
      data: {
        userId: user.id,
        name: d.name,
        targetMinor: d.target,
        currentMinor: d.current ?? 0,
        targetDate: d.targetDate ? new Date(d.targetDate) : null,
        linkedAccountId: d.linkedAccountId ?? null,
        priority: d.priority,
        notes: d.notes ?? null,
      },
    });
    await writeAudit(prisma, { userId: user.id, action: "goal.create", entity: "SavingsGoal", entityId: goal.id, after: { name: d.name, targetMinor: d.target } });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function updateGoal(id: string, raw: unknown): Promise<ActionResult> {
  const parsed = goalSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  try {
    const user = await getCurrentUser();
    // currentMinor is changed via contributeGoal, not here.
    await prisma.savingsGoal.update({
      where: { id },
      data: {
        name: d.name,
        targetMinor: d.target,
        targetDate: d.targetDate ? new Date(d.targetDate) : null,
        linkedAccountId: d.linkedAccountId ?? null,
        priority: d.priority,
        notes: d.notes ?? null,
      },
    });
    await writeAudit(prisma, { userId: user.id, action: "goal.update", entity: "SavingsGoal", entityId: id, after: { name: d.name } });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteGoal(id: string): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    await prisma.savingsGoal.delete({ where: { id } });
    await writeAudit(prisma, { userId: user.id, action: "goal.delete", entity: "SavingsGoal", entityId: id });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Add to (or withdraw from, with a negative amount) a goal's saved total. */
export async function contributeGoal(id: string, raw: unknown): Promise<ActionResult> {
  const parsed = contributeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  try {
    const user = await getCurrentUser();
    const goal = await prisma.savingsGoal.findUniqueOrThrow({ where: { id } });
    const next = Math.max(0, goal.currentMinor + parsed.data.amount);
    await prisma.savingsGoal.update({ where: { id }, data: { currentMinor: next } });
    await writeAudit(prisma, { userId: user.id, action: "goal.contribute", entity: "SavingsGoal", entityId: id, before: { currentMinor: goal.currentMinor }, after: { currentMinor: next } });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
