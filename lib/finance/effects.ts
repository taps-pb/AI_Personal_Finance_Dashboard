// The balance engine (spec §23/§24/§60). PURE — no Prisma. Given a transaction
// and the kinds of the accounts it touches, it returns the exact deltas to each
// account's stored `balanceMinor`. The server action persists these inside one
// DB transaction and writes matching BalanceHistory rows.
//
// Modelled as cash flows first, then translated to stored deltas:
//   asset:     stored += cash   (more cash in the account)
//   liability: stored -= cash   (cash IN pays down what you owe)
// This one rule makes every transaction type fall out correctly.

import type { AccountKind, TxnType } from "../constants.ts";

export interface EffectInput {
  type: TxnType;
  amountMinor: number;
  fromAccountId: string;
  fromKind: AccountKind;
  toAccountId?: string | null;
  toKind?: AccountKind | null;
  feeMinor?: number | null;
  // BALANCE_ADJUSTMENT only: set the from-account's stored balance to targetMinor.
  targetMinor?: number | null;
  currentFromMinor?: number | null;
}

export interface BalanceDelta {
  accountId: string;
  delta: number; // in the account's stored (balanceMinor) space
}

function storedDelta(kind: AccountKind, cashDelta: number): number {
  return kind === "asset" ? cashDelta : -cashDelta;
}

/** Deltas to apply when a transaction is created. Reverse them to undo it. */
export function transactionEffect(t: EffectInput): BalanceDelta[] {
  const amt = t.amountMinor;
  const fee = t.feeMinor ?? 0;

  if (t.type === "BALANCE_ADJUSTMENT") {
    return [{ accountId: t.fromAccountId, delta: (t.targetMinor ?? 0) - (t.currentFromMinor ?? 0) }];
  }

  const cash: { accountId: string; kind: AccountKind; cashDelta: number }[] = [];
  const from = { accountId: t.fromAccountId, kind: t.fromKind };

  switch (t.type) {
    case "EXPENSE":
      cash.push({ ...from, cashDelta: -amt });
      break;
    case "INCOME":
    case "REFUND":
      cash.push({ ...from, cashDelta: +amt });
      break;
    case "TRANSFER":
    case "INVESTMENT":
    case "CREDIT_CARD_PAYMENT": {
      if (!t.toAccountId || !t.toKind) throw new Error(`${t.type} requires a destination account`);
      // from loses amount (+fee on transfers); destination gains amount.
      cash.push({ ...from, cashDelta: -(amt + (t.type === "TRANSFER" ? fee : 0)) });
      cash.push({ accountId: t.toAccountId, kind: t.toKind, cashDelta: +amt });
      break;
    }
  }

  return cash.map((c) => ({ accountId: c.accountId, delta: storedDelta(c.kind, c.cashDelta) }));
}

export function reverseEffect(deltas: BalanceDelta[]): BalanceDelta[] {
  return deltas.map((d) => ({ accountId: d.accountId, delta: -d.delta }));
}

/** Merge deltas for the same account (e.g. an edit that reverses then re-applies). */
export function mergeDeltas(deltas: BalanceDelta[]): BalanceDelta[] {
  const byAccount = new Map<string, number>();
  for (const d of deltas) byAccount.set(d.accountId, (byAccount.get(d.accountId) ?? 0) + d.delta);
  return [...byAccount].map(([accountId, delta]) => ({ accountId, delta }));
}
