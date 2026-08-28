"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/user";
import { writeAudit } from "@/lib/audit";
import { accountSchema, updateBalanceSchema, type ActionResult } from "@/lib/validation";

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/accounts");
  revalidatePath("/transactions");
}

function firstError(e: { issues: { message: string }[] }): string {
  return e.issues[0]?.message ?? "Invalid input";
}

export async function createAccount(raw: unknown): Promise<ActionResult> {
  const parsed = accountSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  try {
    const user = await getCurrentUser();
    await prisma.$transaction(async (tx) => {
      const acc = await tx.account.create({
        data: {
          userId: user.id,
          name: d.name,
          type: d.type,
          institution: d.institution ?? null,
          balanceMinor: d.balance,
          includeInNetWorth: d.includeInNetWorth,
          nickname: d.nickname ?? null,
          description: d.description ?? null,
          icon: d.icon ?? null,
          color: d.color ?? null,
          creditLimitMinor: d.creditLimit ?? null,
          statementDay: d.statementDay ?? null,
          dueDay: d.dueDay ?? null,
          investedMinor: d.investedAmount ?? null,
        },
      });
      await tx.balanceHistory.create({
        data: {
          accountId: acc.id,
          previousMinor: 0,
          newMinor: d.balance,
          diffMinor: d.balance,
          reason: "INITIAL",
          note: "Opening balance",
        },
      });
      await writeAudit(tx, {
        userId: user.id,
        action: "account.create",
        entity: "Account",
        entityId: acc.id,
        after: { name: d.name, type: d.type, balanceMinor: d.balance },
      });
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function updateAccount(id: string, raw: unknown): Promise<ActionResult> {
  const parsed = accountSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  try {
    const user = await getCurrentUser();
    // Balance is edited via updateBalance (keeps history) — updateAccount changes metadata only.
    await prisma.account.update({
      where: { id },
      data: {
        name: d.name,
        type: d.type,
        institution: d.institution ?? null,
        includeInNetWorth: d.includeInNetWorth,
        nickname: d.nickname ?? null,
        description: d.description ?? null,
        icon: d.icon ?? null,
        color: d.color ?? null,
        creditLimitMinor: d.creditLimit ?? null,
        statementDay: d.statementDay ?? null,
        dueDay: d.dueDay ?? null,
        investedMinor: d.investedAmount ?? null,
      },
    });
    await writeAudit(prisma, { userId: user.id, action: "account.update", entity: "Account", entityId: id, after: { name: d.name } });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function setAccountStatus(id: string, status: "active" | "archived"): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    await prisma.account.update({ where: { id }, data: { status } });
    await writeAudit(prisma, { userId: user.id, action: "account.status", entity: "Account", entityId: id, after: { status } });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteAccount(id: string): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    const txnCount = await prisma.transaction.count({
      where: { OR: [{ accountId: id }, { toAccountId: id }] },
    });
    if (txnCount > 0) {
      return {
        ok: false,
        error: `This account has ${txnCount} transaction(s). Archive it instead to preserve history.`,
      };
    }
    await prisma.account.delete({ where: { id } }); // cascades balance history
    await writeAudit(prisma, { userId: user.id, action: "account.delete", entity: "Account", entityId: id });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Manual balance update (spec §3): sets balance and records a history entry. */
export async function updateBalance(raw: unknown): Promise<ActionResult> {
  const parsed = updateBalanceSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  try {
    const user = await getCurrentUser();
    await prisma.$transaction(async (tx) => {
      const acc = await tx.account.findUniqueOrThrow({ where: { id: d.accountId } });
      if (acc.balanceMinor === d.newBalance) return;
      await tx.account.update({ where: { id: d.accountId }, data: { balanceMinor: d.newBalance } });
      await tx.balanceHistory.create({
        data: {
          accountId: d.accountId,
          previousMinor: acc.balanceMinor,
          newMinor: d.newBalance,
          diffMinor: d.newBalance - acc.balanceMinor,
          reason: "MANUAL_UPDATE",
          note: d.note ?? null,
        },
      });
      await writeAudit(tx, {
        userId: user.id,
        action: "account.balance",
        entity: "Account",
        entityId: d.accountId,
        before: { balanceMinor: acc.balanceMinor },
        after: { balanceMinor: d.newBalance },
      });
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
