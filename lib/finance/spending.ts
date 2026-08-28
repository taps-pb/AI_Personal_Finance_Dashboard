// Spending / income classification (spec §60). PURE. Classify by TYPE, never sign.
//   spending = EXPENSE + transfer fees − REFUND
//   income   = INCOME
// Transfers (principal) and credit-card payments are neither.

export interface TxnLike {
  type: string;
  amountMinor: number;
  feeMinor?: number | null;
  date: Date | string;
  categoryId?: string | null;
  accountId: string;
}

/** Amount this transaction contributes to "spending" (can be negative for refunds). */
export function spendingMinor(t: Pick<TxnLike, "type" | "amountMinor" | "feeMinor">): number {
  switch (t.type) {
    case "EXPENSE":
      return t.amountMinor;
    case "REFUND":
      return -t.amountMinor;
    case "TRANSFER":
      return t.feeMinor ?? 0; // only the fee is spending
    default:
      return 0;
  }
}

export function incomeMinor(t: Pick<TxnLike, "type" | "amountMinor">): number {
  return t.type === "INCOME" ? t.amountMinor : 0;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function totalSpending(txns: TxnLike[]): number {
  return sum(txns.map(spendingMinor));
}

export function totalIncome(txns: TxnLike[]): number {
  return sum(txns.map(incomeMinor));
}

export function cashFlow(txns: TxnLike[]): number {
  return totalIncome(txns) - totalSpending(txns);
}

/** (income − spending) / income × 100, safe when income is 0 (spec §13). */
export function savingsRate(txns: TxnLike[]): number {
  const income = totalIncome(txns);
  if (income <= 0) return 0;
  return ((income - totalSpending(txns)) / income) * 100;
}

/** Spending grouped by categoryId (uncategorised => "uncategorized"). */
export function spendingByCategory(txns: TxnLike[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of txns) {
    const amt = spendingMinor(t);
    if (amt === 0) continue;
    const key = t.categoryId ?? "uncategorized";
    m.set(key, (m.get(key) ?? 0) + amt);
  }
  return m;
}

/** Spending grouped by (source) accountId. */
export function spendingByAccount(txns: TxnLike[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of txns) {
    const amt = spendingMinor(t);
    if (amt === 0) continue;
    m.set(t.accountId, (m.get(t.accountId) ?? 0) + amt);
  }
  return m;
}

export function inMonth(date: Date | string, year: number, month0: number): boolean {
  const d = new Date(date);
  return d.getFullYear() === year && d.getMonth() === month0;
}
