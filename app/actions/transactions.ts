"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser, getSettings } from "@/lib/user";
import { applyTransaction, reverseTransactionHistory, type TxnCore } from "@/lib/engine";
import { writeAudit } from "@/lib/audit";
import {
  expenseSchema,
  incomeSchema,
  transferSchema,
  ccPaymentSchema,
  type ActionResult,
} from "@/lib/validation";
import type { TxnType } from "@/lib/constants";

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/accounts");
  revalidatePath("/transactions");
}

function firstError(e: { issues: { message: string }[] }): string {
  return e.issues[0]?.message ?? "Invalid input";
}

interface CreateInput {
  userId: string;
  type: TxnType;
  amountMinor: number;
  name: string;
  date: Date;
  accountId: string;
  toAccountId?: string | null;
  feeMinor?: number | null;
  categoryId?: string | null;
  merchant?: string | null;
  paymentMethod?: string | null;
  description?: string | null;
  tags?: string | null;
}

async function persistCreate(input: CreateInput) {
  const settings = await getSettings(input.userId);
  await prisma.$transaction(async (tx) => {
    const from = await tx.account.findUniqueOrThrow({ where: { id: input.accountId } });
    const to = input.toAccountId ? await tx.account.findUniqueOrThrow({ where: { id: input.toAccountId } }) : null;

    const row = await tx.transaction.create({
      data: {
        userId: input.userId,
        type: input.type,
        amountMinor: input.amountMinor,
        name: input.name,
        date: input.date,
        accountId: input.accountId,
        toAccountId: input.toAccountId ?? null,
        feeMinor: input.feeMinor ?? null,
        categoryId: input.categoryId ?? null,
        merchant: input.merchant ?? null,
        paymentMethod: input.paymentMethod ?? null,
        description: input.description ?? null,
        tags: input.tags ?? null,
      },
    });

    if (settings.autoUpdateBalances) {
      const core: TxnCore = {
        type: input.type,
        amountMinor: input.amountMinor,
        accountId: input.accountId,
        toAccountId: input.toAccountId,
        feeMinor: input.feeMinor,
      };
      await applyTransaction(tx, core, from.type, to?.type ?? null, row.id);
    }

    await writeAudit(tx, {
      userId: input.userId,
      action: "transaction.create",
      entity: "Transaction",
      entityId: row.id,
      after: { type: input.type, amountMinor: input.amountMinor, name: input.name },
    });
  });
  revalidateAll();
}

export async function createExpense(raw: unknown): Promise<ActionResult> {
  const parsed = expenseSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  try {
    const user = await getCurrentUser();
    await persistCreate({
      userId: user.id,
      type: "EXPENSE",
      amountMinor: d.amount,
      name: d.name,
      date: new Date(d.date),
      accountId: d.accountId,
      categoryId: d.categoryId,
      merchant: d.merchant,
      paymentMethod: d.paymentMethod,
      description: d.description,
      tags: d.tags,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function createIncome(raw: unknown): Promise<ActionResult> {
  const parsed = incomeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  try {
    const user = await getCurrentUser();
    await persistCreate({
      userId: user.id,
      type: "INCOME",
      amountMinor: d.amount,
      name: d.name,
      date: new Date(d.date),
      accountId: d.accountId,
      categoryId: d.categoryId,
      description: d.description,
      tags: d.tags,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function createTransfer(raw: unknown): Promise<ActionResult> {
  const parsed = transferSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  try {
    const user = await getCurrentUser();
    await persistCreate({
      userId: user.id,
      type: "TRANSFER",
      amountMinor: d.amount,
      name: d.note || "Transfer",
      date: new Date(d.date),
      accountId: d.fromAccountId,
      toAccountId: d.toAccountId,
      feeMinor: d.fee,
      description: d.note,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function createCcPayment(raw: unknown): Promise<ActionResult> {
  const parsed = ccPaymentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  try {
    const user = await getCurrentUser();
    await persistCreate({
      userId: user.id,
      type: "CREDIT_CARD_PAYMENT",
      amountMinor: d.amount,
      name: d.note || "Credit-card payment",
      date: new Date(d.date),
      accountId: d.fromAccountId,
      toAccountId: d.toAccountId,
      description: d.note,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function persistEdit(id: string, input: CreateInput) {
  const settings = await getSettings(input.userId);
  await prisma.$transaction(async (tx) => {
    const from = await tx.account.findUniqueOrThrow({ where: { id: input.accountId } });
    const to = input.toAccountId ? await tx.account.findUniqueOrThrow({ where: { id: input.toAccountId } }) : null;

    // 1) undo the old effect exactly (and clear its history rows)
    await reverseTransactionHistory(tx, id);

    // 2) update the row (type is preserved)
    await tx.transaction.update({
      where: { id },
      data: {
        amountMinor: input.amountMinor,
        name: input.name,
        date: input.date,
        accountId: input.accountId,
        toAccountId: input.toAccountId ?? null,
        feeMinor: input.feeMinor ?? null,
        categoryId: input.categoryId ?? null,
        merchant: input.merchant ?? null,
        paymentMethod: input.paymentMethod ?? null,
        description: input.description ?? null,
        tags: input.tags ?? null,
      },
    });

    // 3) re-apply the new effect
    if (settings.autoUpdateBalances) {
      const core: TxnCore = {
        type: input.type,
        amountMinor: input.amountMinor,
        accountId: input.accountId,
        toAccountId: input.toAccountId,
        feeMinor: input.feeMinor,
      };
      await applyTransaction(tx, core, from.type, to?.type ?? null, id);
    }

    await writeAudit(tx, {
      userId: input.userId,
      action: "transaction.edit",
      entity: "Transaction",
      entityId: id,
      after: { type: input.type, amountMinor: input.amountMinor, name: input.name },
    });
  });
  revalidateAll();
}

export async function editExpense(id: string, raw: unknown): Promise<ActionResult> {
  const parsed = expenseSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  try {
    const user = await getCurrentUser();
    await persistEdit(id, {
      userId: user.id,
      type: "EXPENSE",
      amountMinor: d.amount,
      name: d.name,
      date: new Date(d.date),
      accountId: d.accountId,
      categoryId: d.categoryId,
      merchant: d.merchant,
      paymentMethod: d.paymentMethod,
      description: d.description,
      tags: d.tags,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function editIncome(id: string, raw: unknown): Promise<ActionResult> {
  const parsed = incomeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  try {
    const user = await getCurrentUser();
    await persistEdit(id, {
      userId: user.id,
      type: "INCOME",
      amountMinor: d.amount,
      name: d.name,
      date: new Date(d.date),
      accountId: d.accountId,
      categoryId: d.categoryId,
      description: d.description,
      tags: d.tags,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function editTransfer(id: string, raw: unknown): Promise<ActionResult> {
  const parsed = transferSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  try {
    const user = await getCurrentUser();
    await persistEdit(id, {
      userId: user.id,
      type: "TRANSFER",
      amountMinor: d.amount,
      name: d.note || "Transfer",
      date: new Date(d.date),
      accountId: d.fromAccountId,
      toAccountId: d.toAccountId,
      feeMinor: d.fee,
      description: d.note,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function editCcPayment(id: string, raw: unknown): Promise<ActionResult> {
  const parsed = ccPaymentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  try {
    const user = await getCurrentUser();
    await persistEdit(id, {
      userId: user.id,
      type: "CREDIT_CARD_PAYMENT",
      amountMinor: d.amount,
      name: d.note || "Credit-card payment",
      date: new Date(d.date),
      accountId: d.fromAccountId,
      toAccountId: d.toAccountId,
      description: d.note,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    await prisma.$transaction(async (tx) => {
      const row = await tx.transaction.findUniqueOrThrow({ where: { id } });
      await reverseTransactionHistory(tx, id); // undo balance effect exactly
      await tx.transaction.delete({ where: { id } });
      await writeAudit(tx, {
        userId: user.id,
        action: "transaction.delete",
        entity: "Transaction",
        entityId: id,
        before: { type: row.type, amountMinor: row.amountMinor, name: row.name },
      });
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
