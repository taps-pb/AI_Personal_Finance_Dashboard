"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser, getSettings } from "@/lib/user";
import { applyTransaction, type TxnCore } from "@/lib/engine";
import { writeAudit } from "@/lib/audit";
import { advance } from "@/lib/finance/recurrence";
import { subscriptionSchema, type ActionResult } from "@/lib/validation";
import type { Frequency } from "@/lib/constants";

function revalidateAll() {
  revalidatePath("/subscriptions");
  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/accounts");
}

function firstError(e: { issues: { message: string }[] }): string {
  return e.issues[0]?.message ?? "Invalid input";
}

export async function createSubscription(raw: unknown): Promise<ActionResult> {
  const parsed = subscriptionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  try {
    const user = await getCurrentUser();
    const start = new Date(d.startDate);
    const next = d.nextBillingDate ? new Date(d.nextBillingDate) : start;
    const sub = await prisma.subscription.create({
      data: {
        userId: user.id,
        name: d.name,
        provider: d.provider ?? null,
        amountMinor: d.amount,
        frequency: d.frequency,
        intervalDays: d.intervalDays ?? null,
        startDate: start,
        nextBillingDate: next,
        accountId: d.accountId ?? null,
        categoryId: d.categoryId ?? null,
        autoRenew: d.autoRenew,
        notes: d.notes ?? null,
      },
    });
    await writeAudit(prisma, { userId: user.id, action: "subscription.create", entity: "Subscription", entityId: sub.id, after: { name: d.name, amountMinor: d.amount } });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function updateSubscription(id: string, raw: unknown): Promise<ActionResult> {
  const parsed = subscriptionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  try {
    const user = await getCurrentUser();
    await prisma.subscription.update({
      where: { id },
      data: {
        name: d.name,
        provider: d.provider ?? null,
        amountMinor: d.amount,
        frequency: d.frequency,
        intervalDays: d.intervalDays ?? null,
        startDate: new Date(d.startDate),
        nextBillingDate: d.nextBillingDate ? new Date(d.nextBillingDate) : new Date(d.startDate),
        accountId: d.accountId ?? null,
        categoryId: d.categoryId ?? null,
        autoRenew: d.autoRenew,
        notes: d.notes ?? null,
      },
    });
    await writeAudit(prisma, { userId: user.id, action: "subscription.update", entity: "Subscription", entityId: id, after: { name: d.name } });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function setSubscriptionStatus(id: string, status: "active" | "paused" | "cancelled"): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    await prisma.subscription.update({ where: { id }, data: { status } });
    await writeAudit(prisma, { userId: user.id, action: "subscription.status", entity: "Subscription", entityId: id, after: { status } });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteSubscription(id: string): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    // Keep any transactions this subscription generated; just unlink them.
    await prisma.$transaction(async (tx) => {
      await tx.transaction.updateMany({ where: { subscriptionId: id }, data: { subscriptionId: null } });
      await tx.subscription.delete({ where: { id } });
      await writeAudit(tx, { userId: user.id, action: "subscription.delete", entity: "Subscription", entityId: id });
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Record a subscription's charge as an expense (spec §9), then advance its next
 * billing date. `lastChargedDate` guards against charging the same cycle twice.
 */
export async function recordSubscriptionCharge(id: string): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    const settings = await getSettings(user.id);
    const sub = await prisma.subscription.findUniqueOrThrow({ where: { id } });
    if (sub.status !== "active") return { ok: false, error: "Only active subscriptions can be charged." };
    if (!sub.accountId) return { ok: false, error: "Assign a payment account to this subscription first." };
    if (sub.lastChargedDate && sub.lastChargedDate.getTime() === sub.nextBillingDate.getTime()) {
      return { ok: false, error: "This billing cycle has already been recorded." };
    }

    await prisma.$transaction(async (tx) => {
      const account = await tx.account.findUniqueOrThrow({ where: { id: sub.accountId! } });
      const t = await tx.transaction.create({
        data: {
          userId: user.id,
          type: "EXPENSE",
          amountMinor: sub.amountMinor,
          name: sub.name,
          date: sub.nextBillingDate,
          accountId: sub.accountId!,
          categoryId: sub.categoryId,
          merchant: sub.provider,
          recurring: true,
          subscriptionId: sub.id,
        },
      });
      if (settings.autoUpdateBalances) {
        const core: TxnCore = { type: "EXPENSE", amountMinor: sub.amountMinor, accountId: sub.accountId! };
        await applyTransaction(tx, core, account.type, null, t.id);
      }
      const next = advance(sub.nextBillingDate, sub.frequency as Frequency, sub.intervalDays);
      await tx.subscription.update({ where: { id }, data: { lastChargedDate: sub.nextBillingDate, nextBillingDate: next } });
      await writeAudit(tx, { userId: user.id, action: "subscription.charge", entity: "Subscription", entityId: id, after: { transactionId: t.id, amountMinor: sub.amountMinor } });
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
