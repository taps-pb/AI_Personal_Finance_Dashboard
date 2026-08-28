// Money-engine tests. Run: npm test  (node --test, native type-stripping).
import { test } from "node:test";
import assert from "node:assert/strict";

import { rupeesToPaise, formatINR, compactINR } from "../lib/money.ts";
import { accountKind, type TxnType } from "../lib/constants.ts";
import { transactionEffect, reverseEffect, type EffectInput } from "../lib/finance/effects.ts";
import {
  netWorth,
  creditCardOutstanding,
  totalInvestments,
  type AccountLike,
} from "../lib/finance/networth.ts";
import { totalSpending, totalIncome, cashFlow, savingsRate } from "../lib/finance/spending.ts";
import { creditUtilization, subscriptionMonthlyEquivalent, investmentReturn } from "../lib/finance/metrics.ts";

// --- tiny in-memory ledger to exercise the engine end to end -----------------
type Acct = AccountLike & { id: string };
function ledger(list: Acct[]) {
  const by = new Map(list.map((a) => [a.id, a]));
  return {
    accounts: () => [...by.values()],
    bal: (id: string) => by.get(id)!.balanceMinor,
    apply(input: Omit<EffectInput, "fromKind" | "toKind">) {
      const full: EffectInput = {
        ...input,
        fromKind: accountKind(by.get(input.fromAccountId)!.type),
        toKind: input.toAccountId ? accountKind(by.get(input.toAccountId)!.type) : null,
      };
      const deltas = transactionEffect(full);
      for (const d of deltas) by.get(d.accountId)!.balanceMinor += d.delta;
      return deltas;
    },
    reverse(deltas: { accountId: string; delta: number }[]) {
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

// --- money -------------------------------------------------------------------
test("rupeesToPaise is exact, no float drift", () => {
  assert.equal(rupeesToPaise("1234.56"), 123456);
  assert.equal(rupeesToPaise(0.1) + rupeesToPaise(0.2), rupeesToPaise(0.3)); // the 0.1+0.2 trap
  assert.equal(rupeesToPaise("₹1,50,000"), 15000000);
  assert.equal(rupeesToPaise("-500"), -50000);
  assert.throws(() => rupeesToPaise("abc"));
});

test("formatINR uses Indian grouping", () => {
  assert.equal(formatINR(20000000), "₹2,00,000");
  assert.equal(formatINR(123456), "₹1,234.56");
  assert.equal(compactINR(1250000000), "₹1.25 Cr");
});

// --- Workflow A: normal expense ---------------------------------------------
test("expense reduces the paying account and counts as spending", () => {
  const l = ledger([mk("icici", "Savings Account", 5000000)]);
  l.apply({ type: "EXPENSE", amountMinor: 50000, fromAccountId: "icici" });
  assert.equal(l.bal("icici"), 4950000); // 50,000 - 500
  assert.equal(totalSpending([{ type: "EXPENSE", amountMinor: 50000, date: "2026-08-28", accountId: "icici" }]), 50000);
});

// --- Workflow B: transfer ----------------------------------------------------
test("transfer moves money without changing net worth/income/spending", () => {
  const l = ledger([mk("icici", "Savings Account", 5000000), mk("hdfc", "Savings Account", 2500000)]);
  l.apply({ type: "TRANSFER", amountMinor: 2000000, fromAccountId: "icici", toAccountId: "hdfc" });
  assert.equal(l.bal("icici"), 3000000);
  assert.equal(l.bal("hdfc"), 4500000);
  assert.equal(netWorth(l.accounts()), 7500000); // unchanged
  const t = [{ type: "TRANSFER" as TxnType, amountMinor: 2000000, date: "2026-08-01", accountId: "icici" }];
  assert.equal(totalSpending(t), 0);
  assert.equal(totalIncome(t), 0);
});

test("transfer fee is the only part counted as spending", () => {
  const l = ledger([mk("icici", "Savings Account", 5000000), mk("hdfc", "Savings Account", 0)]);
  l.apply({ type: "TRANSFER", amountMinor: 2000000, feeMinor: 500, fromAccountId: "icici", toAccountId: "hdfc" });
  assert.equal(l.bal("icici"), 2999500); // lost 20,000 + 5 fee
  assert.equal(l.bal("hdfc"), 2000000);
  assert.equal(totalSpending([{ type: "TRANSFER", amountMinor: 2000000, feeMinor: 500, date: "x", accountId: "icici" }]), 500);
});

// --- Workflow C: credit-card purchase ---------------------------------------
test("credit-card purchase raises outstanding, drops net worth, counts as spending", () => {
  const l = ledger([mk("card", "Credit Card", 0)]);
  l.apply({ type: "EXPENSE", amountMinor: 1000000, fromAccountId: "card" });
  assert.equal(l.bal("card"), 1000000); // outstanding up 10,000
  assert.equal(netWorth(l.accounts()), -1000000); // liability subtracts
  assert.equal(creditCardOutstanding(l.accounts()), 1000000);
});

// --- Workflow D: credit-card payment ----------------------------------------
test("credit-card payment drops bank + outstanding, net worth ~unchanged, not spending", () => {
  const accts = [mk("icici", "Savings Account", 5000000), mk("card", "Credit Card", 1000000)];
  const l = ledger(accts);
  const before = netWorth(l.accounts());
  l.apply({ type: "CREDIT_CARD_PAYMENT", amountMinor: 1000000, fromAccountId: "icici", toAccountId: "card" });
  assert.equal(l.bal("icici"), 4000000);
  assert.equal(l.bal("card"), 0);
  assert.equal(netWorth(l.accounts()), before); // liability and cash both fell equally
  assert.equal(totalSpending([{ type: "CREDIT_CARD_PAYMENT", amountMinor: 1000000, date: "x", accountId: "icici" }]), 0);
});

// --- income ------------------------------------------------------------------
test("income increases account and counts as income only", () => {
  const l = ledger([mk("icici", "Savings Account", 0)]);
  l.apply({ type: "INCOME", amountMinor: 5000000, fromAccountId: "icici" });
  assert.equal(l.bal("icici"), 5000000);
  const t = [{ type: "INCOME" as TxnType, amountMinor: 5000000, date: "x", accountId: "icici" }];
  assert.equal(totalIncome(t), 5000000);
  assert.equal(totalSpending(t), 0);
  assert.equal(cashFlow(t), 5000000);
});

// --- delete reverses exactly (spec §23) -------------------------------------
test("deleting a transaction returns balances exactly", () => {
  const l = ledger([mk("icici", "Savings Account", 5000000)]);
  const deltas = l.apply({ type: "EXPENSE", amountMinor: 100000, fromAccountId: "icici" });
  assert.equal(l.bal("icici"), 4900000);
  l.reverse(deltas);
  assert.equal(l.bal("icici"), 5000000);
});

// --- edit = reverse old then apply new (spec §24) ---------------------------
test("editing ₹1000 ICICI -> ₹1500 HDFC restores and re-applies correctly", () => {
  const l = ledger([mk("icici", "Savings Account", 5000000), mk("hdfc", "Savings Account", 5000000)]);
  const old = l.apply({ type: "EXPENSE", amountMinor: 100000, fromAccountId: "icici" });
  l.reverse(old); // restore ICICI
  l.apply({ type: "EXPENSE", amountMinor: 150000, fromAccountId: "hdfc" });
  assert.equal(l.bal("icici"), 5000000); // fully restored
  assert.equal(l.bal("hdfc"), 4850000); // -1500
});

// --- reconciliation (spec §21) ----------------------------------------------
test("balance adjustment sets the account to the real value", () => {
  const l = ledger([mk("icici", "Savings Account", 4842000)]);
  l.apply({ type: "BALANCE_ADJUSTMENT", amountMinor: 0, fromAccountId: "icici", targetMinor: 4790000, currentFromMinor: 4842000 });
  assert.equal(l.bal("icici"), 4790000); // now matches reality, −520
});

// --- net worth example from spec §1 -----------------------------------------
test("net worth matches the spec §1 example (₹2,00,000)", () => {
  const accts: AccountLike[] = [
    mk("a", "Bank Account", 5000000),
    mk("b", "Bank Account", 2500000),
    mk("c", "Crypto", 9000000),
    mk("d", "Stocks", 4000000),
    mk("e", "Cash", 500000),
    mk("f", "Credit Card", 1000000),
  ];
  assert.equal(netWorth(accts), 20000000); // ₹2,00,000
  assert.equal(totalInvestments(accts), 13000000); // crypto + stocks
});

test("excluded / archived accounts drop out of net worth", () => {
  const accts: AccountLike[] = [
    { type: "Cash", balanceMinor: 100000, includeInNetWorth: true, status: "active" },
    { type: "Cash", balanceMinor: 999999, includeInNetWorth: false, status: "active" },
    { type: "Cash", balanceMinor: 888888, includeInNetWorth: true, status: "archived" },
  ];
  assert.equal(netWorth(accts), 100000);
});

// --- metrics -----------------------------------------------------------------
test("credit utilization and investment return", () => {
  assert.equal(creditUtilization(1250000, 5000000), 25); // spec §10 example
  assert.equal(creditUtilization(100, 0), 0); // no limit => 0, no divide-by-zero
  const r = investmentReturn(4000000, 3000000);
  assert.equal(r.plMinor, 1000000);
  assert.equal(Math.round(r.plPct * 100) / 100, 33.33);
});

test("yearly subscription converts to monthly equivalent", () => {
  assert.equal(subscriptionMonthlyEquivalent(1200000, "yearly"), 100000); // ₹12,000/yr -> ₹1,000/mo
  assert.equal(subscriptionMonthlyEquivalent(199900, "monthly"), 199900);
});

test("savings rate handles zero income", () => {
  assert.equal(savingsRate([{ type: "EXPENSE", amountMinor: 5000, date: "x", accountId: "a" }]), 0);
});
