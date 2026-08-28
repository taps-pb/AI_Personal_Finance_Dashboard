// Read layer for server components. Combines Prisma data with the PURE finance
// libs. Returns plain serializable shapes so client chart components can consume
// them directly. All money in paise.
import { prisma } from "@/lib/db";
import { accountKind } from "@/lib/constants";
import {
  netWorth,
  totalAssets,
  totalLiabilities,
  liquidBalance,
  totalInvestments,
  totalCash,
  creditCardOutstanding,
  type AccountLike,
} from "@/lib/finance/networth";
import {
  totalSpending,
  totalIncome,
  cashFlow,
  savingsRate,
  spendingByCategory,
  spendingMinor,
  incomeMinor,
} from "@/lib/finance/spending";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type AccountRow = Awaited<ReturnType<typeof prisma.account.findMany>>[number];
export type TxnRow = Awaited<ReturnType<typeof prisma.transaction.findMany>>[number];

function monthTxns(txns: TxnRow[], year: number, month0: number) {
  return txns.filter((t) => {
    const d = new Date(t.date);
    return d.getFullYear() === year && d.getMonth() === month0;
  });
}

export async function getAccounts(userId: string) {
  return prisma.account.findMany({ where: { userId }, orderBy: [{ status: "asc" }, { createdAt: "asc" }] });
}

/** Net worth at each of the last `months` month-starts, derived from balance history. */
function netWorthSeries(accounts: AccountRow[], histories: { accountId: string; newMinor: number; createdAt: Date }[], months: number) {
  const now = new Date();
  const byAccount = new Map<string, { newMinor: number; createdAt: Date }[]>();
  for (const h of histories) {
    const arr = byAccount.get(h.accountId) ?? [];
    arr.push(h);
    byAccount.set(h.accountId, arr);
  }
  for (const arr of byAccount.values()) arr.sort((a, b) => +a.createdAt - +b.createdAt);

  const series: { label: string; netWorthMinor: number }[] = [];
  for (let m = months - 1; m >= 0; m--) {
    const boundary = new Date(now.getFullYear(), now.getMonth() - m + 1, 0, 23, 59, 59); // month end
    let nw = 0;
    for (const acc of accounts) {
      if (acc.status === "archived" || !acc.includeInNetWorth) continue;
      const hist = byAccount.get(acc.id) ?? [];
      const upto = hist.filter((h) => h.createdAt <= boundary);
      const bal = upto.length ? upto[upto.length - 1].newMinor : m === 0 ? acc.balanceMinor : hist[0]?.newMinor ?? acc.balanceMinor;
      nw += accountKind(acc.type) === "asset" ? bal : -bal;
    }
    series.push({ label: MONTH_LABELS[boundary.getMonth()], netWorthMinor: nw });
  }
  return series;
}

/** Income vs spending per month for the last `months` months. */
function incomeExpenseSeries(txns: TxnRow[], months: number) {
  const now = new Date();
  const out: { label: string; incomeMinor: number; spendingMinor: number }[] = [];
  for (let m = months - 1; m >= 0; m--) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const mt = monthTxns(txns, d.getFullYear(), d.getMonth());
    out.push({ label: MONTH_LABELS[d.getMonth()], incomeMinor: totalIncome(mt), spendingMinor: totalSpending(mt) });
  }
  return out;
}

export async function getDashboardData(userId: string) {
  const now = new Date();
  const [accounts, txns, categories] = await Promise.all([
    prisma.account.findMany({ where: { userId } }),
    prisma.transaction.findMany({ where: { userId }, orderBy: { date: "desc" } }),
    prisma.category.findMany({ where: { userId } }),
  ]);
  const histories = await prisma.balanceHistory.findMany({
    where: { account: { userId } },
    select: { accountId: true, newMinor: true, createdAt: true },
  });

  const catMap = new Map(categories.map((c) => [c.id, c]));
  const acctLike: AccountLike[] = accounts;

  const thisMonth = monthTxns(txns, now.getFullYear(), now.getMonth());
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = monthTxns(txns, lastMonthDate.getFullYear(), lastMonthDate.getMonth());

  // spending by category (this month) -> named slices
  const byCat = spendingByCategory(thisMonth);
  const categoryBreakdown = [...byCat.entries()]
    .map(([id, amount]) => ({
      id,
      name: id === "uncategorized" ? "Uncategorized" : catMap.get(id)?.name ?? "Uncategorized",
      color: catMap.get(id)?.color ?? "#94a3b8",
      amountMinor: amount,
    }))
    .filter((c) => c.amountMinor > 0)
    .sort((a, b) => b.amountMinor - a.amountMinor);

  const accountDistribution = accounts
    .filter((a) => a.status !== "archived" && accountKind(a.type) === "asset" && a.balanceMinor > 0)
    .map((a) => ({ id: a.id, name: a.name, color: a.color ?? "#6366f1", amountMinor: a.balanceMinor }))
    .sort((a, b) => b.amountMinor - a.amountMinor);

  const recent = txns.slice(0, 8).map((t) => ({
    id: t.id,
    type: t.type,
    name: t.name,
    amountMinor: t.amountMinor,
    date: t.date.toISOString(),
    accountName: accounts.find((a) => a.id === t.accountId)?.name ?? "",
    categoryName: t.categoryId ? catMap.get(t.categoryId)?.name ?? null : null,
    merchant: t.merchant,
  }));

  const largestExpenses = thisMonth
    .filter((t) => spendingMinor(t) > 0)
    .sort((a, b) => spendingMinor(b) - spendingMinor(a))
    .slice(0, 5)
    .map((t) => ({
      id: t.id,
      name: t.name,
      amountMinor: spendingMinor(t),
      categoryName: t.categoryId ? catMap.get(t.categoryId)?.name ?? null : null,
      accountName: accounts.find((a) => a.id === t.accountId)?.name ?? "",
    }));

  return {
    netWorthMinor: netWorth(acctLike),
    totalAssetsMinor: totalAssets(acctLike),
    totalLiabilitiesMinor: totalLiabilities(acctLike),
    liquidMinor: liquidBalance(acctLike),
    investmentsMinor: totalInvestments(acctLike),
    cashMinor: totalCash(acctLike),
    creditOutstandingMinor: creditCardOutstanding(acctLike),
    spendingMinor: totalSpending(thisMonth),
    incomeMinor: totalIncome(thisMonth),
    cashFlowMinor: cashFlow(thisMonth),
    savingsRatePct: savingsRate(thisMonth),
    lastMonthSpendingMinor: totalSpending(lastMonth),
    txnCount: thisMonth.length,
    categoryBreakdown,
    accountDistribution,
    recent,
    largestExpenses,
    netWorthSeries: netWorthSeries(accounts, histories, 6),
    incomeExpenseSeries: incomeExpenseSeries(txns, 6),
  };
}

export async function getAccountDetail(userId: string, accountId: string) {
  const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
  if (!account) return null;
  const [txns, history] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, OR: [{ accountId }, { toAccountId: accountId }] },
      orderBy: { date: "desc" },
      take: 100,
    }),
    prisma.balanceHistory.findMany({ where: { accountId }, orderBy: { createdAt: "asc" } }),
  ]);
  const categories = await prisma.category.findMany({ where: { userId } });
  const catMap = new Map(categories.map((c) => [c.id, c]));

  const moneyOut = txns
    .filter((t) => t.accountId === accountId)
    .reduce((s, t) => s + (spendingMinor(t) > 0 ? spendingMinor(t) : 0), 0);
  const moneyIn = txns.reduce((s, t) => {
    if (t.toAccountId === accountId) return s + t.amountMinor; // received via transfer/cc payment
    return s + incomeMinor(t);
  }, 0);

  return {
    account,
    moneyInMinor: moneyIn,
    moneyOutMinor: moneyOut,
    history: history.map((h) => ({
      label: new Date(h.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      balanceMinor: h.newMinor,
    })),
    txns: txns.map((t) => ({
      id: t.id,
      type: t.type,
      name: t.name,
      amountMinor: t.amountMinor,
      date: t.date.toISOString(),
      direction: t.toAccountId === accountId ? "in" : "out",
      categoryName: t.categoryId ? catMap.get(t.categoryId)?.name ?? null : null,
      merchant: t.merchant,
    })),
  };
}

export interface TxnFilter {
  q?: string;
  accountId?: string;
  categoryId?: string;
  type?: string;
}

export async function getTransactions(userId: string, filter: TxnFilter = {}) {
  const [accounts, categories] = await Promise.all([
    prisma.account.findMany({ where: { userId } }),
    prisma.category.findMany({ where: { userId } }),
  ]);
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const acctMap = new Map(accounts.map((a) => [a.id, a]));

  const where: Record<string, unknown> = { userId };
  if (filter.accountId) where.OR = [{ accountId: filter.accountId }, { toAccountId: filter.accountId }];
  if (filter.categoryId) where.categoryId = filter.categoryId;
  if (filter.type) where.type = filter.type;
  if (filter.q)
    where.AND = [
      {
        OR: [
          { name: { contains: filter.q } },
          { merchant: { contains: filter.q } },
          { description: { contains: filter.q } },
        ],
      },
    ];

  const txns = await prisma.transaction.findMany({ where: where as never, orderBy: { date: "desc" }, take: 300 });
  return {
    accounts,
    categories,
    txns: txns.map((t) => ({
      id: t.id,
      type: t.type,
      name: t.name,
      amountMinor: t.amountMinor,
      feeMinor: t.feeMinor,
      date: t.date.toISOString(),
      accountName: acctMap.get(t.accountId)?.name ?? "",
      toAccountName: t.toAccountId ? acctMap.get(t.toAccountId)?.name ?? null : null,
      categoryName: t.categoryId ? catMap.get(t.categoryId)?.name ?? null : null,
      merchant: t.merchant,
    })),
  };
}
