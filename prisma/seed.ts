// Realistic demo data (spec §57). Run: npm run db:seed  (node strips the types).
// Everything is flagged isDemo so it stays separable from real user data.
// Balances are the source of truth; transactions and balance-history rows are
// planted records so the dashboard, charts, and analytics have meaningful data.

import { makePrisma } from "../lib/prisma-money.ts";

// Money-extended client: BigInt columns read back as `number`, so the balance
// math below (and every other read) stays in plain numbers.
const prisma = makePrisma();

const r = (rupees: number) => Math.round(rupees * 100); // rupees -> paise

// Deterministic RNG so the seed is reproducible.
let seed = 42;
const rand = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
const pick = <T>(xs: T[]): T => xs[Math.floor(rand() * xs.length)];
const between = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));

const EXPENSE_CATEGORIES: Record<string, string[]> = {
  Food: ["Restaurants", "Delivery", "Groceries", "Snacks"],
  Transport: ["Fuel", "Uber/Ola", "Public Transport", "Parking", "Vehicle Maintenance"],
  Shopping: ["Electronics", "Clothing", "Accessories", "Online Shopping"],
  Entertainment: ["Games", "Movies", "Streaming", "Events"],
  Subscriptions: ["Software", "AI Tools", "Streaming", "Gaming", "Cloud Storage"],
  Bills: ["Electricity", "Internet", "Mobile", "Rent", "Utilities"],
  Health: ["Medicines", "Doctor", "Fitness"],
  Education: ["Courses", "Books", "Tuition"],
  Investments: ["Stocks", "Mutual Funds", "Crypto"],
  Other: ["Gifts", "Fees", "Miscellaneous"],
};
const INCOME_CATEGORIES = ["Salary", "Pocket Money", "Freelance", "Interest", "Dividend", "Refund", "Gift", "Other"];

const CATEGORY_COLORS: Record<string, string> = {
  Food: "#f97316",
  Transport: "#3b82f6",
  Shopping: "#a855f7",
  Entertainment: "#ec4899",
  Subscriptions: "#14b8a6",
  Bills: "#ef4444",
  Health: "#22c55e",
  Education: "#eab308",
  Investments: "#6366f1",
  Other: "#64748b",
};

async function main() {
  // Wipe (dev seed) — order respects FKs.
  await prisma.transaction.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.recurringTransaction.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.netWorthSnapshot.deleteMany();
  await prisma.savingsGoal.deleteMany();
  await prisma.balanceHistory.deleteMany();
  await prisma.category.deleteMany();
  await prisma.account.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.user.deleteMany();

  const user = await prisma.user.create({ data: { name: "You" } });
  const userId = user.id;

  await prisma.setting.create({ data: { userId, autoUpdateBalances: true } });

  // Categories --------------------------------------------------------------
  const catId = new Map<string, string>();
  for (const [parent, subs] of Object.entries(EXPENSE_CATEGORIES)) {
    const p = await prisma.category.create({
      data: { userId, name: parent, kind: "expense", color: CATEGORY_COLORS[parent] },
    });
    catId.set(parent, p.id);
    for (const s of subs) {
      const c = await prisma.category.create({
        data: { userId, name: s, kind: "expense", parentId: p.id, color: CATEGORY_COLORS[parent] },
      });
      catId.set(`${parent}/${s}`, c.id);
    }
  }
  for (const name of INCOME_CATEGORIES) {
    const c = await prisma.category.create({ data: { userId, name, kind: "income", color: "#22c55e" } });
    catId.set(`income/${name}`, c.id);
  }

  // Accounts ----------------------------------------------------------------
  const mkAccount = (data: Record<string, unknown>) =>
    prisma.account.create({ data: { userId, currency: "INR", isDemo: true, ...data } as never });

  const icici = await mkAccount({ name: "ICICI Savings", institution: "ICICI Bank", type: "Savings Account", balanceMinor: r(146500), icon: "🏦", color: "#f97316" });
  const hdfc = await mkAccount({ name: "HDFC Savings", institution: "HDFC Bank", type: "Savings Account", balanceMinor: r(78200), icon: "🏦", color: "#3b82f6" });
  const cash = await mkAccount({ name: "Cash", type: "Cash", balanceMinor: r(4200), icon: "💵", color: "#22c55e" });
  const card = await mkAccount({ name: "ICICI Coral", institution: "ICICI Bank", type: "Credit Card", balanceMinor: r(18420), creditLimitMinor: r(150000), statementDay: 5, dueDay: 22, icon: "💳", color: "#ef4444" });
  const stocks = await mkAccount({ name: "Zerodha Stocks", institution: "Zerodha", type: "Stocks", balanceMinor: r(212000), investedMinor: r(180000), icon: "📈", color: "#6366f1" });
  const mf = await mkAccount({ name: "Groww Mutual Funds", institution: "Groww", type: "Mutual Funds", balanceMinor: r(95000), investedMinor: r(88000), icon: "📊", color: "#8b5cf6" });
  const crypto = await mkAccount({ name: "Binance", institution: "Binance", type: "Crypto", balanceMinor: r(64000), investedMinor: r(90000), icon: "🪙", color: "#eab308" });

  const spendAccounts = [icici, hdfc, cash, card];

  // Balance history: 6 monthly snapshots per account trending to current -----
  const now = new Date();
  const assetAccounts = [icici, hdfc, cash, stocks, mf, crypto, card];
  for (const acc of assetAccounts) {
    let prev = Math.round(acc.balanceMinor * (0.72 + rand() * 0.12)); // started lower/higher
    for (let m = 5; m >= 0; m--) {
      const date = new Date(now.getFullYear(), now.getMonth() - m, 1, 10, 0, 0);
      const target = m === 0 ? acc.balanceMinor : Math.round(prev * (0.95 + rand() * 0.2));
      await prisma.balanceHistory.create({
        data: {
          accountId: acc.id,
          previousMinor: prev,
          newMinor: target,
          diffMinor: target - prev,
          reason: m === 5 ? "INITIAL" : "MANUAL_UPDATE",
          createdAt: date,
          note: m === 5 ? "Demo starting balance" : undefined,
        },
      });
      prev = target;
    }
  }

  // Transactions over the last ~90 days -------------------------------------
  const EXPENSE_TEMPLATES: { name: string; parent: string; sub: string; merchant: string; lo: number; hi: number }[] = [
    { name: "Lunch", parent: "Food", sub: "Restaurants", merchant: "Local Cafe", lo: 180, hi: 650 },
    { name: "Zomato order", parent: "Food", sub: "Delivery", merchant: "Zomato", lo: 250, hi: 900 },
    { name: "Groceries", parent: "Food", sub: "Groceries", merchant: "BigBasket", lo: 600, hi: 2400 },
    { name: "Fuel", parent: "Transport", sub: "Fuel", merchant: "HP Petrol", lo: 500, hi: 2000 },
    { name: "Uber ride", parent: "Transport", sub: "Uber/Ola", merchant: "Uber", lo: 90, hi: 480 },
    { name: "Amazon order", parent: "Shopping", sub: "Online Shopping", merchant: "Amazon", lo: 400, hi: 5200 },
    { name: "Movie tickets", parent: "Entertainment", sub: "Movies", merchant: "PVR", lo: 300, hi: 900 },
    { name: "Steam game", parent: "Entertainment", sub: "Games", merchant: "Steam", lo: 500, hi: 2500 },
    { name: "Electricity bill", parent: "Bills", sub: "Electricity", merchant: "MSEB", lo: 800, hi: 2200 },
    { name: "Mobile recharge", parent: "Bills", sub: "Mobile", merchant: "Jio", lo: 239, hi: 799 },
    { name: "Pharmacy", parent: "Health", sub: "Medicines", merchant: "Apollo", lo: 120, hi: 900 },
    { name: "Coffee", parent: "Food", sub: "Snacks", merchant: "Starbucks", lo: 150, hi: 480 },
  ];
  // recurring subscription expenses (spec §8/§9 preview — planted as records)
  const SUBSCRIPTIONS = [
    { name: "ChatGPT Plus", parent: "Subscriptions", sub: "AI Tools", merchant: "OpenAI", amount: 1999, day: 1, account: card },
    { name: "Netflix", parent: "Subscriptions", sub: "Streaming", merchant: "Netflix", amount: 649, day: 8, account: card },
    { name: "Spotify", parent: "Subscriptions", sub: "Streaming", merchant: "Spotify", amount: 119, day: 12, account: icici },
    { name: "iCloud+", parent: "Subscriptions", sub: "Cloud Storage", merchant: "Apple", amount: 75, day: 15, account: card },
  ];

  const txns: Record<string, unknown>[] = [];
  const startDay = 90;
  for (let d = startDay; d >= 0; d--) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - d, between(9, 21), between(0, 59));
    // 0–2 discretionary expenses per day
    const count = rand() < 0.25 ? 0 : rand() < 0.75 ? 1 : 2;
    for (let i = 0; i < count; i++) {
      const t = pick(EXPENSE_TEMPLATES);
      const acc = pick(spendAccounts);
      const amt = r(between(t.lo, t.hi));
      txns.push({
        userId, type: "EXPENSE", amountMinor: amt, name: t.name, date,
        accountId: acc.id, categoryId: catId.get(`${t.parent}/${t.sub}`) ?? catId.get(t.parent),
        merchant: t.merchant, paymentMethod: acc.type === "Credit Card" ? "Credit Card" : "UPI", isDemo: true,
      });
    }
  }

  // Monthly salary income (last 3 month starts)
  for (let m = 2; m >= 0; m--) {
    const date = new Date(now.getFullYear(), now.getMonth() - m, 1, 10, 0);
    txns.push({
      userId, type: "INCOME", amountMinor: r(85000), name: "Salary", date,
      accountId: icici.id, categoryId: catId.get("income/Salary"), merchant: "Acme Corp", recurring: true, isDemo: true,
    });
  }
  // A transfer and a credit-card payment this month
  txns.push({
    userId, type: "TRANSFER", amountMinor: r(20000), name: "Move to HDFC", date: new Date(now.getFullYear(), now.getMonth(), 3, 12, 0),
    accountId: icici.id, toAccountId: hdfc.id, isDemo: true,
  });
  txns.push({
    userId, type: "CREDIT_CARD_PAYMENT", amountMinor: r(15000), name: "Card bill payment", date: new Date(now.getFullYear(), now.getMonth(), 20, 12, 0),
    accountId: icici.id, toAccountId: card.id, isDemo: true,
  });

  // Subscription charges for each of the last 3 months
  for (let m = 2; m >= 0; m--) {
    for (const s of SUBSCRIPTIONS) {
      const date = new Date(now.getFullYear(), now.getMonth() - m, s.day, 6, 0);
      if (date > now) continue;
      txns.push({
        userId, type: "EXPENSE", amountMinor: r(s.amount), name: s.name, date,
        accountId: s.account.id, categoryId: catId.get(`${s.parent}/${s.sub}`) ?? catId.get(s.parent),
        merchant: s.merchant, paymentMethod: s.account.type === "Credit Card" ? "Credit Card" : "UPI", recurring: true, isDemo: true,
      });
    }
  }

  await prisma.transaction.createMany({ data: txns as never });

  // Subscriptions (spec §8) -------------------------------------------------
  const soon = (days: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 6, 0);
  const subDefs = [
    { name: "ChatGPT Plus", provider: "OpenAI", amount: 1999, frequency: "monthly", account: card, cat: "Subscriptions/AI Tools", days: 2 },
    { name: "Google AI Pro", provider: "Google", amount: 1950, frequency: "monthly", account: card, cat: "Subscriptions/AI Tools", days: 6 },
    { name: "Netflix", provider: "Netflix", amount: 649, frequency: "monthly", account: card, cat: "Subscriptions/Streaming", days: 11 },
    { name: "Spotify", provider: "Spotify", amount: 119, frequency: "monthly", account: icici, cat: "Subscriptions/Streaming", days: 18 },
    { name: "iCloud+", provider: "Apple", amount: 75, frequency: "monthly", account: card, cat: "Subscriptions/Cloud Storage", days: 24 },
    { name: "Domain renewal", provider: "GoDaddy", amount: 1200, frequency: "yearly", account: icici, cat: "Bills/Utilities", days: 40 },
  ];
  for (const s of subDefs) {
    await prisma.subscription.create({
      data: {
        userId, name: s.name, provider: s.provider, amountMinor: r(s.amount), frequency: s.frequency,
        startDate: new Date(now.getFullYear(), now.getMonth() - 3, 1), nextBillingDate: soon(s.days),
        accountId: s.account.id, categoryId: catId.get(s.cat) ?? null, autoRenew: true, isDemo: true,
      },
    });
  }

  // Recurring transactions (spec §19) --------------------------------------
  await prisma.recurringTransaction.create({
    data: { userId, type: "INCOME", amountMinor: r(85000), name: "Salary", accountId: icici.id, categoryId: catId.get("income/Salary") ?? null, frequency: "monthly", nextDate: new Date(now.getFullYear(), now.getMonth() + 1, 1), isDemo: true },
  });
  await prisma.recurringTransaction.create({
    data: { userId, type: "EXPENSE", amountMinor: r(18000), name: "Rent", accountId: icici.id, categoryId: catId.get("Bills/Rent") ?? null, frequency: "monthly", nextDate: new Date(now.getFullYear(), now.getMonth() + 1, 5), isDemo: true },
  });

  // Budgets (spec §12) ------------------------------------------------------
  const budgetDefs: [string | null, number][] = [
    [null, 40000],
    ["Food", 8000],
    ["Entertainment", 3000],
    ["Shopping", 5000],
    ["Subscriptions", 5000],
  ];
  for (const [catName, amount] of budgetDefs) {
    await prisma.budget.create({ data: { userId, categoryId: catName ? catId.get(catName) ?? null : null, amountMinor: r(amount), isDemo: true } });
  }

  // Net-worth snapshots (spec §18) — 6 monthly points trending to current -----
  const assetsMinor = icici.balanceMinor + hdfc.balanceMinor + cash.balanceMinor + stocks.balanceMinor + mf.balanceMinor + crypto.balanceMinor;
  const liabMinor = card.balanceMinor;
  const nwNow = assetsMinor - liabMinor;
  for (let m = 6; m >= 0; m--) {
    const date = new Date(now.getFullYear(), now.getMonth() - m, 1, 12, 0);
    const factor = m === 0 ? 1 : 0.8 + (6 - m) * 0.03;
    const assets = Math.round(assetsMinor * factor);
    await prisma.netWorthSnapshot.create({
      data: { userId, date, totalAssetsMinor: assets, totalLiabilitiesMinor: liabMinor, netWorthMinor: assets - liabMinor, isDemo: true },
    });
  }
  void nwNow;

  // Savings goals (spec §20) -----------------------------------------------
  const goalDefs = [
    { name: "Emergency fund", target: 100000, current: 45000, priority: "high", months: 6, account: icici },
    { name: "New laptop", target: 200000, current: 120000, priority: "medium", months: 4, account: hdfc },
    { name: "Goa vacation", target: 150000, current: 30000, priority: "low", months: 12, account: hdfc },
  ];
  for (const g of goalDefs) {
    await prisma.savingsGoal.create({
      data: {
        userId, name: g.name, targetMinor: r(g.target), currentMinor: r(g.current), priority: g.priority,
        targetDate: new Date(now.getFullYear(), now.getMonth() + g.months, 15), linkedAccountId: g.account.id, isDemo: true,
      },
    });
  }

  console.log(`Seeded: 1 user, 7 accounts, ${catId.size} categories, ${txns.length} transactions, ${subDefs.length} subscriptions, 2 recurring, ${budgetDefs.length} budgets, 7 snapshots, ${goalDefs.length} goals (all demo).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
