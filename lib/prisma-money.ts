// The money boundary for Prisma. Side-effect free (constructs no client at
// import), so both lib/db.ts (the app singleton) and the node --test integration
// suite can share it.
//
// Money columns are BigInt in the schema so large balances/portfolios never
// overflow 32-bit Int. The application computes in `number` (exact to
// MAX_SAFE_INTEGER paise). This is the SINGLE read boundary: every `*Minor`
// field is converted bigint -> number (guarded) here, so no domain/query/UI
// code ever sees a bigint and RSC/JSON serialization never trips over one.
// Writes need no conversion — Prisma's BigInt input type accepts a plain number.
import { PrismaClient, Prisma } from "@prisma/client";
import type { ITXClientDenyList } from "@prisma/client/runtime/library";
import { toNumberMinor } from "./money.ts";

const m = toNumberMinor;
const mn = (v: bigint | number | null): number | null => (v == null ? null : toNumberMinor(v));

// One entry per monetary column (all names end in "Minor"). Explicit so Prisma
// infers each field's type as `number`, keeping reads type-safe end to end.
export const moneyExtension = Prisma.defineExtension({
  name: "money-bigint-to-number",
  result: {
    account: {
      balanceMinor: { needs: { balanceMinor: true }, compute: (a) => m(a.balanceMinor) },
      creditLimitMinor: { needs: { creditLimitMinor: true }, compute: (a) => mn(a.creditLimitMinor) },
      minDueMinor: { needs: { minDueMinor: true }, compute: (a) => mn(a.minDueMinor) },
      investedMinor: { needs: { investedMinor: true }, compute: (a) => mn(a.investedMinor) },
    },
    balanceHistory: {
      previousMinor: { needs: { previousMinor: true }, compute: (r) => m(r.previousMinor) },
      newMinor: { needs: { newMinor: true }, compute: (r) => m(r.newMinor) },
      diffMinor: { needs: { diffMinor: true }, compute: (r) => m(r.diffMinor) },
    },
    transaction: {
      amountMinor: { needs: { amountMinor: true }, compute: (t) => m(t.amountMinor) },
      feeMinor: { needs: { feeMinor: true }, compute: (t) => mn(t.feeMinor) },
    },
    subscription: {
      amountMinor: { needs: { amountMinor: true }, compute: (s) => m(s.amountMinor) },
    },
    recurringTransaction: {
      amountMinor: { needs: { amountMinor: true }, compute: (r) => m(r.amountMinor) },
    },
    budget: {
      amountMinor: { needs: { amountMinor: true }, compute: (b) => m(b.amountMinor) },
    },
    netWorthSnapshot: {
      totalAssetsMinor: { needs: { totalAssetsMinor: true }, compute: (s) => m(s.totalAssetsMinor) },
      totalLiabilitiesMinor: { needs: { totalLiabilitiesMinor: true }, compute: (s) => m(s.totalLiabilitiesMinor) },
      netWorthMinor: { needs: { netWorthMinor: true }, compute: (s) => m(s.netWorthMinor) },
    },
    savingsGoal: {
      targetMinor: { needs: { targetMinor: true }, compute: (g) => m(g.targetMinor) },
      currentMinor: { needs: { currentMinor: true }, compute: (g) => m(g.currentMinor) },
    },
  },
});

/** Build a money-aware client. `url` overrides the datasource (used by tests). */
export function makePrisma(url?: string) {
  const base = url ? new PrismaClient({ datasources: { db: { url } } }) : new PrismaClient();
  return base.$extends(moneyExtension);
}

export type ExtendedPrisma = ReturnType<typeof makePrisma>;

/** The client OR an interactive-transaction client of it — what mutation
 * helpers (engine, audit) accept, so `prisma` and a `$transaction` tx both fit. */
export type Db = Omit<ExtendedPrisma, ITXClientDenyList>;
