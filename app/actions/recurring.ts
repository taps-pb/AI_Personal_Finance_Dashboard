"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser, getSettings } from "@/lib/user";
import { applyTransaction, type TxnCore } from "@/lib/engine";
import { writeAudit } from "@/lib/audit";
import { advance } from "@/lib/finance/recurrence";
import { recurringSchema, type ActionResult } from "@/lib/validation";
import type { Frequency, TxnType } from "@/lib/constants";

function revalidateAll() {
  revalidatePath("/subscriptions");
  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/accounts");
}

function firstError(e: { issues: { message: string }[] }): string {
  return e.issues[0]?.message ?? "Invalid input";
}

function validateTransfer(type: string, accountId: string, toAccountId?: string): string | null {
  if (type !== "TRANSFER") return null;
  if (!toAccountId) return "Transfers need a destination account.";
  if (toAccountId === accountId) return "From and to accounts cannot be the same.";
  return null;
}

export async function createRecurring(raw: unknown): Promise<ActionResult> {
  const parsed = recurringSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  const tErr = validateTransfer(d.type, d.accountId, d.toAccountId);
  if (tErr) return { ok: false, error: tErr };
  try {
    const user = await getCurrentUser();
    const rec = await prisma.recurringTransaction.create({
      data: {
        userId: user.id,
        type: d.type,
        amountMinor: d.amount,
        name: d.name,
        accountId: d.accountId,
        toAccountId: d.type === "TRANSFER" ? d.toAccountId ?? null : null,
        categoryId: d.categoryId ?? null,
        frequency: d.frequency,
        intervalDays: d.intervalDays ?? null,
        nextDate: new Date(d.nextDate),
        notes: d.notes ?? null,
      },
    });
    await writeAudit(prisma, { userId: user.id, action: "recurring.create", entity: "RecurringTransaction", entityId: rec.id, after: { name: d.name } });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function updateRecurring(id: string, raw: unknown): Promise<ActionResult> {
  const parsed = recurringSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  const tErr = validateTransfer(d.type, d.accountId, d.toAccountId);
  if (tErr) return { ok: false, error: tErr };
  try {
    const user = await getCurrentUser();
    await prisma.recurringTransaction.update({
      where: { id },
      data: {
        type: d.type,
        amountMinor: d.amount,
        name: d.name,
        accountId: d.accountId,
        toAccountId: d.type === "TRANSFER" ? d.toAccountId ?? null : null,
        categoryId: d.categoryId ?? null,
        frequency: d.frequency,
        intervalDays: d.intervalDays ?? null,
        nextDate: new Date(d.nextDate),
        notes: d.notes ?? null,
      },
    });
    await writeAudit(prisma, { userId: user.id, action: "recurring.update", entity: "RecurringTransaction", entityId: id, after: { name: d.name } });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteRecurring(id: string): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    await prisma.recurringTransaction.delete({ where: { id } });
    await writeAudit(prisma, { userId: user.id, action: "recurring.delete", entity: "RecurringTransaction", entityId: id });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Post a recurring transaction now (spec §19), then advance its next date. */
export async function recordRecurring(id: string): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    const settings = await getSettings(user.id);
    const rec = await prisma.recurringTransaction.findUniqueOrThrow({ where: { id } });

    await prisma.$transaction(async (tx) => {
      const from = await tx.account.findUniqueOrThrow({ where: { id: rec.accountId } });
      const to = rec.toAccountId ? await tx.account.findUniqueOrThrow({ where: { id: rec.toAccountId } }) : null;
      const t = await tx.transaction.create({
        data: {
          userId: user.id,
          type: rec.type,
          amountMinor: rec.amountMinor,
          name: rec.name,
          date: rec.nextDate,
          accountId: rec.accountId,
          toAccountId: rec.toAccountId,
          categoryId: rec.categoryId,
          recurring: true,
        },
      });
      if (settings.autoUpdateBalances) {
        const core: TxnCore = { type: rec.type as TxnType, amountMinor: rec.amountMinor, accountId: rec.accountId, toAccountId: rec.toAccountId };
        await applyTransaction(tx, core, from.type, to?.type ?? null, t.id);
      }
      const next = advance(rec.nextDate, rec.frequency as Frequency, rec.intervalDays);
      await tx.recurringTransaction.update({ where: { id }, data: { lastRunDate: rec.nextDate, nextDate: next } });
      await writeAudit(tx, { userId: user.id, action: "recurring.record", entity: "RecurringTransaction", entityId: id, after: { transactionId: t.id } });
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
