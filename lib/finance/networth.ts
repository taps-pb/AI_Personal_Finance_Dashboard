// Net worth + balance buckets (spec §1). PURE. All values in paise.

import {
  accountKind,
  CASH_ACCOUNT_TYPES,
  INVESTMENT_ACCOUNT_TYPES,
  LIQUID_ACCOUNT_TYPES,
} from "../constants.ts";

export interface AccountLike {
  type: string;
  balanceMinor: number;
  includeInNetWorth: boolean;
  status: string; // "active" | "archived"
}

const isActive = (a: AccountLike) => a.status !== "archived";
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Σ assets − Σ liabilities, over active accounts flagged include-in-net-worth. */
export function netWorth(accounts: AccountLike[]): number {
  return sum(
    accounts
      .filter((a) => isActive(a) && a.includeInNetWorth)
      .map((a) => (accountKind(a.type) === "asset" ? a.balanceMinor : -a.balanceMinor)),
  );
}

export function totalAssets(accounts: AccountLike[]): number {
  return sum(
    accounts
      .filter((a) => isActive(a) && a.includeInNetWorth && accountKind(a.type) === "asset")
      .map((a) => a.balanceMinor),
  );
}

export function totalLiabilities(accounts: AccountLike[]): number {
  return sum(
    accounts
      .filter((a) => isActive(a) && accountKind(a.type) === "liability")
      .map((a) => a.balanceMinor),
  );
}

function bucket(accounts: AccountLike[], types: readonly string[]): number {
  return sum(accounts.filter((a) => isActive(a) && types.includes(a.type)).map((a) => a.balanceMinor));
}

export const liquidBalance = (a: AccountLike[]) => bucket(a, LIQUID_ACCOUNT_TYPES);
export const totalInvestments = (a: AccountLike[]) => bucket(a, INVESTMENT_ACCOUNT_TYPES);
export const totalCash = (a: AccountLike[]) => bucket(a, CASH_ACCOUNT_TYPES);

/** Outstanding on credit cards only. */
export function creditCardOutstanding(accounts: AccountLike[]): number {
  return bucket(accounts, ["Credit Card"]);
}
