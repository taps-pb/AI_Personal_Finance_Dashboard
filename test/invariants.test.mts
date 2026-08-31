// Full financial invariant matrix over the PURE engine (no Prisma). Complements
// finance.test.mts (spec workflows) and engine.db.test.mts (real DB path).
// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";

import { accountKind, type TxnType } from "../lib/constants.ts";
import {
  transactionEffect,
  reverseEffect,
  mergeDeltas,
  type EffectInput,
  type BalanceDelta,
} from "../lib/finance/effects.ts";
import { netWorth, type AccountLike } from "../lib/finance/networth.ts";
import { totalSpending } from "../lib/finance/spending.ts";
import { transferSchema } from "../lib/validation.ts";
import { toNumberMinor, MAX_SAFE_MINOR } from "../lib/money.ts";

type Acct = AccountLike & { id: string };

function ledger(list: Acct[]) {
  const by = new Map(list.map((a) => [a.id, a]));
  return {
    accounts: () => [...by.values()],
    bal: (id: string) => by.get(id)!.balanceMinor,
    apply(input: Omit<EffectInput, "fromKind" | "toKind">): BalanceDelta[] {
      const full: EffectInput = {
        ...input,
        fromKind: accountKind(by.get(input.fromAccountId)!.type),
        toKind: input.toAccountId ? accountKind(by.get(input.toAccountId)!.type) : null,
      };
      const deltas = transactionEffect(full);
      for (const d of deltas) by.get(d.accountId)!.balanceMinor += d.delta;
      return deltas;
    },
    reverse(deltas: BalanceDelta[]) {
      for (const d of reverseEffect(deltas)) by.get(d.accountId)!.balanceMinor += d.delta;
    },
  };
}

const mk = (id: string, type: string, bal: number): Acct => ({
  id,
  type,
  balanceMinor: bal,
  includeInNetWorth: true,
  status: "active",
});

// ---------------------------------------------------------------------------
// Asset-account matrix
// ---------------------------------------------------------------------------
test("asset: income / expense / refund move cash the right way", () => {
  const l = ledger([mk("bank", "Bank Account", 1000000)]); // ₹10,000
  l.apply({ type: "INCOME", amountMinor: 500000, fromAccountId: "bank" });
  assert.equal(l.bal("bank"), 1500000);
  l.apply({ type: "EXPENSE", amountMinor: 200000, fromAccountId: "bank" });
  assert.equal(l.bal("bank"), 1300000);
  l.apply({ type: "REFUND", amountMinor: 50000, fromAccountId: "bank" });
  assert.equal(l.bal("bank"), 1350000); // refund adds cash back
});

test("asset: transfer in and transfer out net to zero across the pair", () => {
  const l = ledger([mk("a", "Bank Account", 1000000), mk("b", "Cash", 0)]);
  const before = netWorth(l.accounts());
  l.apply({ type: "TRANSFER", amountMinor: 300000, fromAccountId: "a", toAccountId: "b" });
  assert.equal(l.bal("a"), 700000);
  assert.equal(l.bal("b"), 300000);
  assert.equal(netWorth(l.accounts()), before); // net worth unchanged
});

// ---------------------------------------------------------------------------
// Liability-account matrix
// ---------------------------------------------------------------------------
test("liability: purchase raises debt, refund lowers it, payment lowers it", () => {
  const l = ledger([mk("bank", "Bank Account", 5000000), mk("card", "Credit Card", 1000000)]);
  l.apply({ type: "EXPENSE", amountMinor: 200000, fromAccountId: "card" });
  assert.equal(l.bal("card"), 1200000); // owed ₹12,000
  assert.equal(totalSpending([{ type: "EXPENSE", amountMinor: 200000, date: "x", accountId: "card" }]), 200000);

  l.apply({ type: "REFUND", amountMinor: 200000, fromAccountId: "card" });
  assert.equal(l.bal("card"), 1000000); // refund reduces what you owe

  const before = netWorth(l.accounts());
  l.apply({ type: "CREDIT_CARD_PAYMENT", amountMinor: 500000, fromAccountId: "bank", toAccountId: "card" });
  assert.equal(l.bal("bank"), 4500000);
  assert.equal(l.bal("card"), 500000);
  assert.equal(netWorth(l.accounts()), before); // payment is net-worth neutral
  // ...and a card payment is never counted as new spending:
  assert.equal(totalSpending([{ type: "CREDIT_CARD_PAYMENT", amountMinor: 500000, date: "x", accountId: "bank" }]), 0);
});

test("liability: BALANCE_ADJUSTMENT sets outstanding to an exact value", () => {
  const l = ledger([mk("loan", "Loan", 5000000)]);
  l.apply({ type: "BALANCE_ADJUSTMENT", amountMinor: 0, fromAccountId: "loan", targetMinor: 4800000, currentFromMinor: 5000000 });
  assert.equal(l.bal("loan"), 4800000);
});

// ---------------------------------------------------------------------------
// Transfer variants + investment
// ---------------------------------------------------------------------------
test("transfer variants keep net worth flat; fee is the only spending", () => {
  for (const [fromT, toT] of [
    ["Bank Account", "Bank Account"],
    ["Bank Account", "Cash"],
    ["Savings Account", "Bank Account"],
  ] as const) {
    const l = ledger([mk("s", fromT, 1000000), mk("d", toT, 0)]);
    const before = netWorth(l.accounts());
    l.apply({ type: "TRANSFER", amountMinor: 400000, feeMinor: 1000, fromAccountId: "s", toAccountId: "d" });
    assert.equal(l.bal("s"), 599000); // −₹4,000 −₹10 fee
    assert.equal(l.bal("d"), 400000);
    assert.equal(netWorth(l.accounts()), before - 1000); // only the fee leaves net worth
  }
});

test("investment moves cash bank -> investment, net worth unchanged, not spending", () => {
  const l = ledger([mk("bank", "Bank Account", 5000000), mk("mf", "Mutual Funds", 0)]);
  const before = netWorth(l.accounts());
  l.apply({ type: "INVESTMENT", amountMinor: 1000000, fromAccountId: "bank", toAccountId: "mf" });
  assert.equal(l.bal("bank"), 4000000);
  assert.equal(l.bal("mf"), 1000000);
  assert.equal(netWorth(l.accounts()), before);
  assert.equal(totalSpending([{ type: "INVESTMENT", amountMinor: 1000000, date: "x", accountId: "bank" }]), 0);
});

// ---------------------------------------------------------------------------
// Edit = reverse-old-then-apply-new, across type changes
// ---------------------------------------------------------------------------
function edit(l: ReturnType<typeof ledger>, old: BalanceDelta[], next: Omit<EffectInput, "fromKind" | "toKind">) {
  l.reverse(old);
  return l.apply(next);
}

test("edit expense -> larger expense lands on the new amount exactly", () => {
  const l = ledger([mk("bank", "Bank Account", 1000000)]);
  const d0 = l.apply({ type: "EXPENSE", amountMinor: 200000, fromAccountId: "bank" });
  assert.equal(l.bal("bank"), 800000);
  edit(l, d0, { type: "EXPENSE", amountMinor: 500000, fromAccountId: "bank" });
  assert.equal(l.bal("bank"), 500000); // not 300000, not 700000
});

test("edit expense -> income flips the effect", () => {
  const l = ledger([mk("bank", "Bank Account", 1000000)]);
  const d0 = l.apply({ type: "EXPENSE", amountMinor: 200000, fromAccountId: "bank" });
  edit(l, d0, { type: "INCOME", amountMinor: 200000, fromAccountId: "bank" });
  assert.equal(l.bal("bank"), 1200000);
});

test("edit expense -> transfer (and account change) restores source, moves both", () => {
  const l = ledger([mk("bank", "Bank Account", 1000000), mk("b2", "Bank Account", 0)]);
  const d0 = l.apply({ type: "EXPENSE", amountMinor: 300000, fromAccountId: "bank" });
  assert.equal(l.bal("bank"), 700000);
  edit(l, d0, { type: "TRANSFER", amountMinor: 300000, fromAccountId: "bank", toAccountId: "b2" });
  assert.equal(l.bal("bank"), 700000); // −300000 as a transfer this time
  assert.equal(l.bal("b2"), 300000);
});

test("edit transfer -> expense removes the destination effect", () => {
  const l = ledger([mk("bank", "Bank Account", 1000000), mk("b2", "Bank Account", 500000)]);
  const d0 = l.apply({ type: "TRANSFER", amountMinor: 200000, fromAccountId: "bank", toAccountId: "b2" });
  assert.equal(l.bal("b2"), 700000);
  edit(l, d0, { type: "EXPENSE", amountMinor: 200000, fromAccountId: "bank" });
  assert.equal(l.bal("bank"), 800000);
  assert.equal(l.bal("b2"), 500000); // destination fully restored
});

test("edit changing the source account restores the old source", () => {
  const l = ledger([mk("a", "Bank Account", 1000000), mk("b", "Bank Account", 1000000)]);
  const d0 = l.apply({ type: "EXPENSE", amountMinor: 250000, fromAccountId: "a" });
  edit(l, d0, { type: "EXPENSE", amountMinor: 250000, fromAccountId: "b" });
  assert.equal(l.bal("a"), 1000000); // old source restored
  assert.equal(l.bal("b"), 750000);
});

// ---------------------------------------------------------------------------
// Deletion returns balances exactly, for every type
// ---------------------------------------------------------------------------
test("delete restores balances exactly for each transaction type", () => {
  const types: { type: TxnType; extra?: Partial<EffectInput> }[] = [
    { type: "EXPENSE" },
    { type: "INCOME" },
    { type: "REFUND" },
    { type: "TRANSFER", extra: { toAccountId: "dst", feeMinor: 700 } },
    { type: "CREDIT_CARD_PAYMENT", extra: { toAccountId: "card" } },
    { type: "INVESTMENT", extra: { toAccountId: "mf" } },
  ];
  for (const { type, extra } of types) {
    const l = ledger([
      mk("bank", "Bank Account", 5000000),
      mk("dst", "Bank Account", 1000000),
      mk("card", "Credit Card", 800000),
      mk("mf", "Mutual Funds", 0),
    ]);
    const snapshot = Object.fromEntries(l.accounts().map((a) => [a.id, a.balanceMinor]));
    const deltas = l.apply({ type, amountMinor: 300000, fromAccountId: "bank", ...extra });
    l.reverse(deltas);
    for (const a of l.accounts()) assert.equal(a.balanceMinor, snapshot[a.id], `${type} did not restore ${a.id}`);
  }
});

// ---------------------------------------------------------------------------
// Guards: malformed / same-account
// ---------------------------------------------------------------------------
test("two-sided types throw without a destination account", () => {
  for (const type of ["TRANSFER", "CREDIT_CARD_PAYMENT", "INVESTMENT"] as TxnType[]) {
    assert.throws(
      () => transactionEffect({ type, amountMinor: 100000, fromAccountId: "a", fromKind: "asset" }),
      /requires a destination/,
    );
  }
});

test("same-account transfer is rejected at the validation boundary", () => {
  const r = transferSchema.safeParse({ fromAccountId: "a", toAccountId: "a", amount: "100", date: "2026-01-01" });
  assert.equal(r.success, false);
});

// ---------------------------------------------------------------------------
// Money BigInt<->number boundary guard
// ---------------------------------------------------------------------------
test("toNumberMinor converts bigint exactly and guards MAX_SAFE_INTEGER", () => {
  assert.equal(toNumberMinor(BigInt(5_000_000_000)), 5_000_000_000); // ₹5 crore, past Int32
  assert.equal(toNumberMinor(42), 42);
  assert.equal(MAX_SAFE_MINOR, Number.MAX_SAFE_INTEGER);
  assert.throws(() => toNumberMinor(BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1)), /safe integer range/);
});

test("mergeDeltas collapses repeated accounts (edit reverse+apply on same account)", () => {
  const merged = mergeDeltas([
    { accountId: "a", delta: -500 },
    { accountId: "a", delta: 500 },
    { accountId: "b", delta: 200 },
  ]);
  assert.deepEqual(
    merged.sort((x, y) => x.accountId.localeCompare(y.accountId)),
    [{ accountId: "a", delta: 0 }, { accountId: "b", delta: 200 }],
  );
});
