// Server-side bridge between the PURE balance engine (lib/finance/effects.ts)
// and Prisma. This is the ONLY place account balances are mutated by
// transactions, so a balance and its BalanceHistory row always move together.
import type { Prisma } from "@prisma/client";
import { accountKind } from "@/lib/constants";
import { transactionEffect, type BalanceDelta, type EffectInput } from "@/lib/finance/effects";

type Tx = Prisma.TransactionClient;

export interface TxnCore {
  type: EffectInput["type"];
  amountMinor: number;
  accountId: string;
  toAccountId?: string | null;
  feeMinor?: number | null;
  // BALANCE_ADJUSTMENT only:
  targetMinor?: number | null;
  currentFromMinor?: number | null;
}

/** Build the pure effect input from a transaction + the two accounts' types. */
export function buildEffect(t: TxnCore, fromType: string, toType?: string | null): EffectInput {
  return {
    type: t.type,
    amountMinor: t.amountMinor,
    fromAccountId: t.accountId,
    fromKind: accountKind(fromType),
    toAccountId: t.toAccountId ?? null,
    toKind: toType ? accountKind(toType) : null,
    feeMinor: t.feeMinor ?? 0,
    targetMinor: t.targetMinor ?? null,
    currentFromMinor: t.currentFromMinor ?? null,
  };
}

/** Apply balance deltas + write a BalanceHistory row for each touched account. */
export async function applyDeltas(
  db: Tx,
  deltas: BalanceDelta[],
  meta: { reason: string; transactionId?: string; note?: string },
) {
  for (const d of deltas) {
    if (d.delta === 0) continue;
    const acc = await db.account.findUniqueOrThrow({ where: { id: d.accountId } });
    const newMinor = acc.balanceMinor + d.delta;
    await db.account.update({ where: { id: d.accountId }, data: { balanceMinor: newMinor } });
    await db.balanceHistory.create({
      data: {
        accountId: d.accountId,
        previousMinor: acc.balanceMinor,
        newMinor,
        diffMinor: d.delta,
        reason: meta.reason,
        transactionId: meta.transactionId,
        note: meta.note,
      },
    });
  }
}

/** Apply a transaction's effect (create). */
export async function applyTransaction(db: Tx, t: TxnCore, fromType: string, toType: string | null, transactionId: string) {
  const deltas = transactionEffect(buildEffect(t, fromType, toType));
  await applyDeltas(db, deltas, { reason: "TRANSACTION", transactionId });
}

/**
 * Reverse a transaction by undoing the exact BalanceHistory rows it wrote, then
 * removing them. Using the recorded rows (not a recompute) guarantees an exact
 * reversal for every type, and is self-correcting when the transaction never
 * moved balances (no rows -> nothing to undo). Spec §23/§24.
 */
export async function reverseTransactionHistory(db: Tx, transactionId: string) {
  const rows = await db.balanceHistory.findMany({ where: { transactionId } });
  for (const h of rows) {
    const acc = await db.account.findUniqueOrThrow({ where: { id: h.accountId } });
    await db.account.update({
      where: { id: h.accountId },
      data: { balanceMinor: acc.balanceMinor - h.diffMinor },
    });
  }
  await db.balanceHistory.deleteMany({ where: { transactionId } });
}
