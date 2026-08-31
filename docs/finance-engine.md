# Finance Engine — Semantics & Invariants

This document is the authoritative description of how money moves in the AI
Personal Finance Dashboard. A contributor should be able to change balance logic
correctly **from this document alone**, without reverse-engineering the code.

The rule of the project: **a personal finance application should be boringly
correct before it is impressively clever.** Everything below exists to keep
balances exact and recoverable.

---

## 1. Money representation

- Money is stored and computed as **integer minor units (paise)**. `₹123.45`
  is `12345`. Never floats — floating-point arithmetic is unsafe for money
  (`0.1 + 0.2 !== 0.3`).
- Rupee input is parsed to paise at the trust boundary with
  `rupeesToPaise()` (`lib/money.ts`): it strips `₹`, commas and spaces, rejects
  non-numeric input, and does `Math.round(Number(x) * 100)` so the binary-float
  epsilon (e.g. `1234.56 * 100 = 123456.0000001`) is rounded away.
- Formatting is centralized in `lib/money.ts` (`formatINR`, `compactINR`,
  `formatSignedINR`) using `Intl.NumberFormat("en-IN")` for Indian grouping
  (`₹1,50,000`) and lakh/crore compaction (`₹1.25 Cr`).

## 2. Account kinds

Every account is either an **asset** or a **liability**
(`accountKind()` in `lib/constants.ts`). Liability types are Credit Card, Loan,
Buy Now Pay Later, Other Liability; everything else is an asset.

`balanceMinor` means:

- **asset**: how much value the account holds (higher = richer).
- **liability**: how much is **outstanding / owed** (higher = more debt).

**Net worth = Σ(asset balances) − Σ(liability balances)** over active,
include-in-net-worth accounts (`lib/finance/networth.ts`).

## 3. The one rule that makes every transaction type correct

A transaction is modelled first as **cash flows**, then each cash flow is
translated to a stored `balanceMinor` delta with a single rule
(`lib/finance/effects.ts`):

```
asset:     stored += cash     (more cash in the account)
liability: stored -= cash     (cash IN pays down what you owe)
```

From this one rule, every transaction type falls out:

| Type | From account | To account | Counts as | Net worth |
|---|---|---|---|---|
| **EXPENSE** | asset −amt / liability +amt (outstanding up) | — | spending | ↓ |
| **INCOME** | asset +amt | — | income | ↑ |
| **REFUND** | asset +amt / liability −amt (outstanding down) | — | negative spending | ↑ |
| **TRANSFER** | from −(amt+fee) | to +amt | only the fee is spending | unchanged (fee ↓) |
| **CREDIT_CARD_PAYMENT** | bank(asset) −amt | card(liability) −amt outstanding | neither | unchanged |
| **INVESTMENT** | bank(asset) −amt | investment(asset) +amt | neither | unchanged |
| **BALANCE_ADJUSTMENT** | set to target, record diff | — | neither | changes by diff |

Worked examples (the invariants the tests assert):

- **Expense from asset.** Bank ₹10,000, expense ₹2,000 → ₹8,000.
- **Income into asset.** ₹10,000 + income ₹5,000 → ₹15,000.
- **Credit-card purchase.** Card outstanding ₹10,000 + purchase ₹2,000 →
  ₹12,000 owed; counts as spending; net worth drops.
- **Credit-card payment.** Bank ₹50,000 & card owed ₹10,000, pay ₹5,000 →
  Bank ₹45,000, card owed ₹5,000. Net worth unchanged; **not** counted as new
  spending (the original purchase was already the expense).
- **Transfer.** ₹10,000 Bank A → Bank B: A −₹10,000, B +₹10,000. Not income,
  not spending, net worth identical.
- **Refund.** Reverses the economic effect: to an asset it adds cash; to a card
  it reduces what you owe.

## 4. Classification is by TYPE, never by sign

`lib/finance/spending.ts` classifies by the explicit transaction `type`, never
by the sign of an amount:

- **spending** = EXPENSE + transfer fees − REFUND.
- **income** = INCOME.
- **transfers, card payments, investments, balance adjustments** are neither.
- **cash flow** = income − spending. **savings rate** =
  `(income − spending) / income × 100`, and is `0` when income is `0`
  (no divide-by-zero). An internal transfer is never counted as savings.

Amounts are always stored positive; meaning comes from `type`. This is why the
type is explicit on every transaction and never inferred.

## 5. Persistence: balance and history always move together

`lib/engine.ts` is the **only** place a transaction mutates balances.

- `applyTransaction()` computes the pure deltas and, for each touched account,
  updates `balanceMinor` **and** writes a matching `BalanceHistory` row
  (`previousMinor`, `newMinor`, `diffMinor`, `reason`, `transactionId`).
- Both happen inside the **same** `prisma.$transaction` opened by the server
  action, so a balance and its history are never out of step. If any step
  throws, the whole thing rolls back — you never get "transaction row exists but
  balance wasn't updated" or "source decreased but destination didn't increase".

## 6. Delete = reverse the recorded history exactly

`reverseTransactionHistory()` reads the `BalanceHistory` rows that this
transaction wrote and undoes **exactly those diffs**, then deletes the rows. It
does **not** recompute the old effect. This guarantees:

- an exact reversal for every type, even if the effect formula later changes;
- self-correction when the transaction never moved balances (auto-update was
  off → no rows → nothing to undo).

Deleting a transaction therefore returns every affected balance to precisely its
pre-transaction value.

## 7. Edit = reverse-old-then-apply-new (atomic)

Editing reuses the two functions above inside one `$transaction`
(`persistEdit` in `app/actions/transactions.ts`):

1. `reverseTransactionHistory()` — undo the old effect exactly and clear its
   history rows.
2. Update the transaction row.
3. `applyTransaction()` — apply the new effect and write fresh history.

So editing a ₹2,000 expense to ₹5,000 lands on **₹5,000 of effect**, not ₹3,000
(only-the-difference) and not ₹7,000 (double-applied). The reversal uses the
persisted historical delta rather than recalculating the old effect, which is
what guarantees the edit restores the exact original state before re-applying.

## 8. Manual balance update / reconciliation

`updateBalance()` sets an account to a new value and records a `MANUAL_UPDATE`
history row for the difference (no-op if unchanged). `BALANCE_ADJUSTMENT`
transactions do the same through the engine, recording the diff so net-worth and
per-account history stay auditable — you can always answer *"why is this balance
₹X?"* from `BalanceHistory`.

## 9. Atomicity checklist (must hold for every money mutation)

- Multi-record money mutations run inside `prisma.$transaction`.
- A balance change always writes a `BalanceHistory` row in the same transaction.
- A transfer moves **both** sides or neither.
- A delete restores **every** account it originally touched.
- On any failure, **all** changes roll back.

## 10. Test coverage

- `test/finance.test.mts` — pure engine per the spec's core workflows.
- `test/invariants.test.mts` — the full type matrix (asset/liability/transfer/
  investment/refund, edit type-changes, exact delete restoration, malformed
  input guards).
- `test/engine.db.test.mts` — **real** path: `engine → Prisma → SQLite →
  BalanceHistory`, asserting Scenarios A–D end to end against a temporary
  database.
- `test/recurrence.test.mts`, `test/goals.test.mts`, `test/csv.test.mts` — date
  math, goals/forecast, CSV round-trip.
