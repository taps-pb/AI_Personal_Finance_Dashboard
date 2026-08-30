// Shared domain constants + type unions. Pure (no Prisma), so finance libs and
// the app both import from here. SQLite has no enums, so these strings are the
// source of truth for `type`/`status` columns, validated in app code.

export const ACCOUNT_TYPES = [
  "Bank Account",
  "Savings Account",
  "Current Account",
  "Cash",
  "Digital Wallet",
  "UPI Wallet",
  "Credit Card",
  "Investment Account",
  "Stocks",
  "Mutual Funds",
  "Crypto",
  "Fixed Deposit",
  "Recurring Deposit",
  "Loan",
  "Buy Now Pay Later",
  "Other Asset",
  "Other Liability",
  "Custom",
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

// Liability accounts store `balanceMinor` as outstanding (higher = more owed)
// and SUBTRACT from net worth. Everything else is an asset.
export const LIABILITY_ACCOUNT_TYPES: readonly string[] = [
  "Credit Card",
  "Loan",
  "Buy Now Pay Later",
  "Other Liability",
];

export const INVESTMENT_ACCOUNT_TYPES: readonly string[] = [
  "Investment Account",
  "Stocks",
  "Mutual Funds",
  "Crypto",
  "Fixed Deposit",
  "Recurring Deposit",
];

export const CASH_ACCOUNT_TYPES: readonly string[] = ["Cash"];

// "Liquid" = spendable-now money.
export const LIQUID_ACCOUNT_TYPES: readonly string[] = [
  "Bank Account",
  "Savings Account",
  "Current Account",
  "Cash",
  "Digital Wallet",
  "UPI Wallet",
];

export type AccountKind = "asset" | "liability";

export function accountKind(type: string): AccountKind {
  return LIABILITY_ACCOUNT_TYPES.includes(type) ? "liability" : "asset";
}

// Explicit transaction types (spec §41). Type is never inferred from amount sign.
export const TXN_TYPES = [
  "EXPENSE",
  "INCOME",
  "TRANSFER",
  "CREDIT_CARD_PAYMENT",
  "BALANCE_ADJUSTMENT",
  "REFUND",
  "INVESTMENT",
] as const;
export type TxnType = (typeof TXN_TYPES)[number];

export const TXN_TYPE_LABELS: Record<TxnType, string> = {
  EXPENSE: "Expense",
  INCOME: "Income",
  TRANSFER: "Transfer",
  CREDIT_CARD_PAYMENT: "Credit-card payment",
  BALANCE_ADJUSTMENT: "Balance adjustment",
  REFUND: "Refund",
  INVESTMENT: "Investment",
};

export const CURRENCY = "INR";

export const BILLING_FREQUENCIES = [
  "weekly",
  "monthly",
  "every2months",
  "quarterly",
  "every6months",
  "yearly",
  "custom",
] as const;
export type Frequency = (typeof BILLING_FREQUENCIES)[number];

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  every2months: "Every 2 months",
  quarterly: "Quarterly",
  every6months: "Every 6 months",
  yearly: "Yearly",
  custom: "Custom interval",
};
