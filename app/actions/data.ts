"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser, getSettings } from "@/lib/user";
import { applyTransaction, type TxnCore } from "@/lib/engine";
import { writeAudit } from "@/lib/audit";
import { rupeesToPaise } from "@/lib/money";
import { BACKUP_VERSION } from "@/lib/backup";
import type { ActionResult } from "@/lib/validation";

function revalidateEverything() {
  for (const p of ["/", "/accounts", "/transactions", "/subscriptions", "/budgets", "/goals", "/analytics", "/settings"]) revalidatePath(p);
}

export async function updateSettings(input: { autoUpdateBalances?: boolean }): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    await getSettings(user.id);
    await prisma.setting.update({ where: { userId: user.id }, data: { autoUpdateBalances: input.autoUpdateBalances } });
    revalidateEverything();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export interface ImportRow {
  date: string;
  amount: string;
  name: string;
  type?: string;
  account: string;
  category?: string;
  merchant?: string;
}

/** Import mapped CSV rows as EXPENSE/INCOME transactions (skips exact duplicates). */
export async function importTransactions(rows: ImportRow[]): Promise<ActionResult & { imported?: number; skipped?: number }> {
  try {
    const user = await getCurrentUser();
    const settings = await getSettings(user.id);
    const accounts = await prisma.account.findMany({ where: { userId: user.id } });
    const categories = await prisma.category.findMany({ where: { userId: user.id } });
    const acctByName = new Map(accounts.map((a) => [a.name.toLowerCase(), a]));
    const catByName = new Map(categories.map((c) => [c.name.toLowerCase(), c]));

    let imported = 0;
    let skipped = 0;
    for (const row of rows) {
      const acct = acctByName.get((row.account ?? "").toLowerCase());
      if (!acct) {
        skipped++;
        continue;
      }
      let amountMinor: number;
      try {
        amountMinor = rupeesToPaise(row.amount);
      } catch {
        skipped++;
        continue;
      }
      if (amountMinor <= 0) {
        skipped++;
        continue;
      }
      const type = (row.type ?? "EXPENSE").toUpperCase() === "INCOME" ? "INCOME" : "EXPENSE";
      const date = new Date(row.date);
      if (Number.isNaN(date.getTime())) {
        skipped++;
        continue;
      }
      // Duplicate guard: same day + amount + name + account.
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const dup = await prisma.transaction.findFirst({
        where: { userId: user.id, accountId: acct.id, amountMinor, name: row.name, date: { gte: dayStart, lt: dayEnd } },
      });
      if (dup) {
        skipped++;
        continue;
      }
      const category = row.category ? catByName.get(row.category.toLowerCase()) : undefined;
      await prisma.$transaction(async (tx) => {
        const t = await tx.transaction.create({
          data: { userId: user.id, type, amountMinor, name: row.name || "Imported", date, accountId: acct.id, categoryId: category?.id ?? null, merchant: row.merchant || null },
        });
        if (settings.autoUpdateBalances) {
          const core: TxnCore = { type, amountMinor, accountId: acct.id };
          await applyTransaction(tx, core, acct.type, null, t.id);
        }
      });
      imported++;
    }
    await writeAudit(prisma, { userId: user.id, action: "data.import", entity: "Transaction", entityId: "bulk", after: { imported, skipped } });
    revalidateEverything();
    return { ok: true, imported, skipped };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

const revive = <T extends Record<string, unknown>>(row: T, fields: string[]): T => {
  const o: Record<string, unknown> = { ...row };
  for (const f of fields) if (o[f]) o[f] = new Date(o[f] as string);
  return o as T;
};

/** Wipe this user's data and rebuild it from a backup JSON string (spec §37). */
export async function restoreBackup(jsonString: string): Promise<ActionResult> {
  let parsed: { version?: number; data?: Record<string, unknown[]> & { setting?: unknown } };
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return { ok: false, error: "That file isn't valid JSON." };
  }
  if (parsed.version !== BACKUP_VERSION || !parsed.data || !Array.isArray(parsed.data.accounts)) {
    return { ok: false, error: "Unrecognized or incompatible backup file." };
  }
  const d = parsed.data as Record<string, Record<string, unknown>[]> & { setting?: Record<string, unknown> | null };
  try {
    const user = await getCurrentUser();
    const uid = user.id;
    const withUser = (rows: Record<string, unknown>[], dates: string[]): Record<string, unknown>[] =>
      rows.map((r) => ({ ...revive(r, dates), userId: uid }));

    await prisma.$transaction(async (tx) => {
      // wipe (FK-safe order)
      await tx.transaction.deleteMany({ where: { userId: uid } });
      await tx.subscription.deleteMany({ where: { userId: uid } });
      await tx.recurringTransaction.deleteMany({ where: { userId: uid } });
      await tx.budget.deleteMany({ where: { userId: uid } });
      await tx.netWorthSnapshot.deleteMany({ where: { userId: uid } });
      await tx.savingsGoal.deleteMany({ where: { userId: uid } });
      await tx.balanceHistory.deleteMany({ where: { account: { userId: uid } } });
      await tx.auditLog.deleteMany({ where: { userId: uid } });
      await tx.category.deleteMany({ where: { userId: uid } });
      await tx.account.deleteMany({ where: { userId: uid } });

      // recreate (dependency order; ids preserved so FKs line up)
      await tx.account.createMany({ data: withUser(d.accounts, ["createdAt", "updatedAt"]) as never });
      const cats = withUser(d.categories ?? [], []);
      await tx.category.createMany({ data: cats.filter((c) => !c.parentId) as never });
      await tx.category.createMany({ data: cats.filter((c) => c.parentId) as never });
      await tx.subscription.createMany({ data: withUser(d.subscriptions ?? [], ["startDate", "nextBillingDate", "lastChargedDate", "createdAt", "updatedAt"]) as never });
      await tx.transaction.createMany({ data: withUser(d.transactions ?? [], ["date", "createdAt", "updatedAt"]) as never });
      await tx.recurringTransaction.createMany({ data: withUser(d.recurring ?? [], ["nextDate", "lastRunDate", "createdAt", "updatedAt"]) as never });
      await tx.budget.createMany({ data: withUser(d.budgets ?? [], ["createdAt", "updatedAt"]) as never });
      await tx.savingsGoal.createMany({ data: withUser(d.goals ?? [], ["targetDate", "createdAt", "updatedAt"]) as never });
      await tx.netWorthSnapshot.createMany({ data: withUser(d.snapshots ?? [], ["date", "createdAt"]) as never });
      await tx.balanceHistory.createMany({ data: (d.balanceHistory ?? []).map((r) => revive(r, ["createdAt"])) as never });
      await tx.auditLog.createMany({ data: withUser(d.auditLog ?? [], ["timestamp"]) as never });
      if (d.setting) {
        await tx.setting.update({ where: { userId: uid }, data: { autoUpdateBalances: (d.setting.autoUpdateBalances as boolean) ?? true } });
      }
    });
    revalidateEverything();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `Restore failed: ${(e as Error).message}` };
  }
}

/** Delete ALL of this user's financial data (keeps the account + fresh settings). */
export async function deleteAllData(): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    const uid = user.id;
    await prisma.$transaction(async (tx) => {
      await tx.transaction.deleteMany({ where: { userId: uid } });
      await tx.subscription.deleteMany({ where: { userId: uid } });
      await tx.recurringTransaction.deleteMany({ where: { userId: uid } });
      await tx.budget.deleteMany({ where: { userId: uid } });
      await tx.netWorthSnapshot.deleteMany({ where: { userId: uid } });
      await tx.savingsGoal.deleteMany({ where: { userId: uid } });
      await tx.balanceHistory.deleteMany({ where: { account: { userId: uid } } });
      await tx.category.deleteMany({ where: { userId: uid } });
      await tx.account.deleteMany({ where: { userId: uid } });
      await tx.auditLog.deleteMany({ where: { userId: uid } });
    });
    revalidateEverything();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
