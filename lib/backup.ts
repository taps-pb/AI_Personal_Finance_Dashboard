// Full backup + CSV/JSON export (spec §36/§37). Read side.
import { prisma } from "@/lib/db";
import { toCSV } from "@/lib/csv";

export const BACKUP_VERSION = 1;

export async function buildBackup(userId: string) {
  const [accounts, categories, transactions, balanceHistory, subscriptions, recurring, budgets, goals, snapshots, auditLog, setting] =
    await Promise.all([
      prisma.account.findMany({ where: { userId } }),
      prisma.category.findMany({ where: { userId } }),
      prisma.transaction.findMany({ where: { userId } }),
      prisma.balanceHistory.findMany({ where: { account: { userId } } }),
      prisma.subscription.findMany({ where: { userId } }),
      prisma.recurringTransaction.findMany({ where: { userId } }),
      prisma.budget.findMany({ where: { userId } }),
      prisma.savingsGoal.findMany({ where: { userId } }),
      prisma.netWorthSnapshot.findMany({ where: { userId } }),
      prisma.auditLog.findMany({ where: { userId } }),
      prisma.setting.findUnique({ where: { userId } }),
    ]);
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: "AI Personal Finance Dashboard",
    data: { accounts, categories, transactions, balanceHistory, subscriptions, recurring, budgets, goals, snapshots, auditLog, setting },
  };
}

export async function buildTransactionsRows(userId: string) {
  const [txns, accounts, categories] = await Promise.all([
    prisma.transaction.findMany({ where: { userId }, orderBy: { date: "desc" } }),
    prisma.account.findMany({ where: { userId } }),
    prisma.category.findMany({ where: { userId } }),
  ]);
  const acct = new Map(accounts.map((a) => [a.id, a.name]));
  const cat = new Map(categories.map((c) => [c.id, c.name]));
  return txns.map((t) => ({
    date: t.date.toISOString().slice(0, 10),
    type: t.type,
    name: t.name,
    amount: (t.amountMinor / 100).toFixed(2),
    account: acct.get(t.accountId) ?? "",
    toAccount: t.toAccountId ? acct.get(t.toAccountId) ?? "" : "",
    category: t.categoryId ? cat.get(t.categoryId) ?? "" : "",
    merchant: t.merchant ?? "",
    paymentMethod: t.paymentMethod ?? "",
    notes: t.description ?? "",
    tags: t.tags ?? "",
    recurring: t.recurring ? "yes" : "no",
  }));
}

export async function buildTransactionsCSV(userId: string): Promise<string> {
  return toCSV(await buildTransactionsRows(userId));
}
