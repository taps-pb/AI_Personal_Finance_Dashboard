# AI Personal Finance Dashboard

A manual-entry personal finance "command center" — track every account, expense, income, transfer, and credit card in one place, and see net worth, spending, and cash flow at a glance. Built local-first with a strict focus on **financial correctness** (see [conventions](#financial-conventions)).

> **Status: complete** — all six build phases are implemented. Every nav item is live (nothing is a placeholder).

The full original product specification is preserved verbatim at [`docs/finance-spec.md`](docs/finance-spec.md).

## Features

- **Dashboard** — net worth, liquid / investments / cash / credit outstanding, monthly spending vs income vs cash flow, net-worth and income-vs-spending charts, spending by category, account distribution, recent transactions, largest expenses, upcoming subscriptions, credit-card dues, and deterministic financial insights.
- **Accounts** — 18 account types, each with balance history, a detail page (monthly in/out, spending by category), credit-card limit / utilization / available credit, and investment profit/loss.
- **Transactions** — add / edit / delete Expense, Income, Transfer (with optional fee), and Credit-card payment via a global **+ Add** menu; rich search + filters (text, account, category, type, amount range, date range, recurring). Edits and deletes recalculate balances exactly.
- **Categories** — manage expense/income categories and subcategories with icons and colors.
- **Subscriptions & recurring** — track subscriptions (monthly-equivalent, annual cost, upcoming renewals), record a renewal as an expense, and manage arbitrary recurring transactions (salary, rent, EMIs…).
- **Budgets** — overall and per-category monthly limits with progress, status and projected month-end.
- **Analytics** — time ranges (7D → all + custom), spend/income trend, comparison vs the previous period, category / account / merchant breakdowns, net-worth movement, and a month-end forecast.
- **Goals** — savings goals with progress, remaining, required monthly contribution and target date.
- **AI assistant** — ask questions answered only from your data via deterministic tool functions (`claude-opus-5`); degrades gracefully without an API key.
- **Notifications** — in-app alerts for renewals, card dues, budgets, low balances and reached goals.
- **Data** — CSV / JSON export, full JSON backup + restore, CSV import (column mapping, preview, duplicate skip), and an audit trail. Settings for automatic balance updates.
- **Correct balances** — every transaction updates balances atomically and is reversed exactly on delete/edit. Transfers and card payments never count as spending or income.
- **Light / dark / system theme**, responsive (sidebar on desktop, bottom nav on mobile).

## Tech stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Prisma 6** + **SQLite** (single local file)
- **Tailwind CSS v4** + **Radix UI** primitives + **lucide-react** icons
- **Recharts** for charts, **next-themes** for theming, **Zod** for validation
- **Anthropic SDK** (`claude-opus-5`) for the AI assistant (optional; set `ANTHROPIC_API_KEY`)

## Getting started

```bash
npm install
cp .env.example .env          # DATABASE_URL is already set for local SQLite
npm run db:migrate            # create the database and tables
npm run db:seed               # optional: load realistic demo data
npm run dev                   # http://localhost:3000
```

> If `npm install` skips Prisma's engine download (newer npm blocks install scripts), the engines are still fetched; if a Prisma command reports a missing engine, run `npx prisma generate`.

### Environment variables

| Variable            | Purpose                                                        |
| ------------------- | ------------------------------------------------------------- |
| `DATABASE_URL`      | SQLite file path (default `file:./dev.db`, under `prisma/`).  |
| `ANTHROPIC_API_KEY` | AI assistant (`claude-opus-5`). Optional — leave empty to disable it. Server-side only. |

Secrets stay server-side and out of git (`.env` is ignored; `.env.example` is committed).

## Commands

| Command              | What it does                                             |
| -------------------- | -------------------------------------------------------- |
| `npm run dev`        | Start the dev server                                     |
| `npm run build`      | Production build                                         |
| `npm test`           | Run the money-engine tests (`node --test`)               |
| `npm run db:migrate` | Apply Prisma migrations (`prisma migrate dev`)           |
| `npm run db:seed`    | Load demo data (`prisma/seed.ts`)                        |
| `npm run db:reset`   | Drop, re-migrate, and re-seed the database               |
| `npm run lint`       | ESLint                                                   |

### Database & migrations

Schema lives in [`prisma/schema.prisma`](prisma/schema.prisma). After editing it, run `npm run db:migrate` to create a new migration. Seed data (7 accounts, ~100 transactions across three months) is in [`prisma/seed.ts`](prisma/seed.ts) and is flagged `isDemo` so it stays separable from real entries.

## Architecture

```
lib/money.ts            Integer-paise money + Indian (₹, lakh/crore) formatting
lib/constants.ts        Account/transaction type unions + asset/liability classification
lib/finance/            PURE, unit-tested financial logic (no DB):
  effects.ts              balance deltas per transaction type
  networth.ts             net worth + liquid/investment/cash buckets
  spending.ts             spending/income classification (by type, never by sign)
  metrics.ts              credit utilization, investment return, subscription math
lib/engine.ts           Bridges the pure engine to Prisma (the only place txns move balances)
lib/queries.ts          Read layer for pages (Prisma + finance libs -> serializable data)
lib/validation.ts       Zod schemas (rupee strings -> paise at the trust boundary)
app/actions/            Server actions (create/delete transactions, accounts, balances)
app/                    Dashboard, Accounts (+detail), Transactions pages
components/             UI primitives, charts, quick-add, forms
test/                   Money-engine tests
```

The layering is deliberate (UI / server actions / read queries / **pure finance** / validation / DB are separate). Financial formulas exist **only** in `lib/finance/*` and `lib/money.ts` and are covered by tests.

## Financial conventions

- **Money is integer paise.** ₹123.45 is stored as `12345`. No floating-point money math, ever.
- **Transaction type is explicit**, never inferred from amount sign: `EXPENSE`, `INCOME`, `TRANSFER`, `CREDIT_CARD_PAYMENT`, `BALANCE_ADJUSTMENT`, `REFUND`, `INVESTMENT`.
- **Assets vs liabilities.** Liability accounts (credit card, loan, BNPL) store `balanceMinor` as *outstanding* and **subtract** from net worth. `Net worth = Σ assets − Σ liabilities` over active accounts flagged include-in-net-worth.
- **Spending is classified by type, not sign:** spending = expenses + transfer fees − refunds; income = income only. Transfers and card payments are neither.
- **Balances and history move together.** Every balance change writes a `BalanceHistory` row inside one DB transaction; deleting a transaction undoes exactly what it recorded.

## Testing

```bash
npm test
```

Covers the spec's critical workflows: add/delete/edit expense, income, transfer (incl. fee), credit-card purchase, credit-card payment, reconciliation, net-worth calculation, and yearly→monthly subscription conversion.
