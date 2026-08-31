# AI Personal Finance Dashboard — Handoff

A self-contained handoff so a fresh chat (or a new developer) can pick this project up cold. It covers what was built, why, phase by phase, the reasoning/thought process behind the decisions, the gotchas hit along the way, what's verified, and what's still missing.

---

## 1. TL;DR

A **manual-entry personal finance "command center"** built from a detailed 65-section spec (preserved verbatim at [`docs/finance-spec.md`](docs/finance-spec.md)). It tracks accounts, transactions, subscriptions, budgets, goals, net worth and analytics, with an AI assistant that answers questions grounded only in your real data.

- **Status: feature-complete across all six planned phases.** Every nav item is live (no placeholders).
- **Non-negotiable design goal:** financial correctness. Money is integer **paise** (no floats); transaction types stay distinct; edits/deletes reverse balances exactly. This is verified by unit tests and a live end-to-end run.
- **Stack:** Next.js 16 (App Router) + React 19 + TypeScript, Prisma 6 + SQLite (one local file), Tailwind v4 + Radix UI, Recharts, Zod. AI via **Groq** (OpenAI-compatible).
- **Single-user, no auth** (by choice), **INR only**, local-first.

The original build plan lives at `~/.claude/plans/ai-personal-finance-enchanted-nest.md` (outside the repo).

---

## 2. How to run it

```bash
npm install
cp .env.example .env         # then fill in GROQ_API_KEY if you want the AI assistant
npm run db:migrate           # create/upgrade the SQLite DB (prisma/dev.db)
npm run db:seed              # optional: load realistic demo data (7 accounts, ~100 txns, subs, budgets, goals)
npm run dev                  # http://localhost:3000
```

Other scripts (`package.json`):
- `npm test` — money-engine tests via native `node --test` (no test framework).
- `npm run build` — production build.
- `npm run lint` — ESLint.
- `npm run db:reset` — drop, re-migrate, re-seed.

### Environment variables (`.env`, gitignored)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLite path, default `file:./dev.db` (relative to `prisma/`). |
| `GROQ_API_KEY` | AI assistant. Optional — empty disables it gracefully. **Server-side only.** |
| `GROQ_MODEL` | Optional model override. Default `openai/gpt-oss-120b` (must support tool calling). |

`.env` is gitignored; `.env.example` (no real secrets) is committed.

---

## 3. Stack decisions & the reasoning

The project was greenfield (empty repo). Decisions were made with a "laziest solution that actually works" bias (reuse over build, boring over clever), while never compromising financial correctness.

- **Next.js full-stack (App Router).** The spec needs a server (AI key must stay server-side, DB, protected-ish routes). One framework covers UI + server actions + the AI route. Confirmed with the user as "best for a local personal project."
- **Prisma + SQLite (single file).** Lazy-correct for single-user local: typed schema, migrations, seed for free. **Originally installed Prisma 7, then downgraded to Prisma 6** — Prisma 7 dropped in-schema `url` and requires a driver adapter (native `better-sqlite3`), which npm's blocked install scripts would fail to build. Prisma 6 is engine-based, `url` in schema, zero adapter. Boring and reliable.
- **Money as integer paise, everywhere.** Spec §22 forbids floats. `Math.round(Number(x) * 100)` at the input boundary; all math on integers; format with `Intl.NumberFormat("en-IN")`. Safe well beyond any realistic amount.
- **Single-user, no auth.** Confirmed with the user. Every row still carries `userId` (one seeded default user), so multi-user is a later add with no schema change.
- **Tailwind v4 + Radix primitives, hand-rolled components.** Rather than run `shadcn` init on bleeding-edge Next 16 / React 19 / Tailwind 4 (finicky), the small set of UI primitives (button, card, dialog, select, tabs, dropdown, input, label, badge) were written directly on top of Radix. Accessible primitives without fighting a generator.
- **Recharts** for charts, **next-themes** for light/dark/system, **Zod** for validation.
- **Tests via native `node --test`** (Node 24 strips types) — no Jest/Vitest dependency. This required: `"type": "module"` in package.json, `allowImportingTsExtensions: true` in tsconfig, `.ts` extensions on internal lib-to-lib imports, and test files named `*.test.mts`.
- **Seed runs with `node prisma/seed.ts`** (Node's native TS stripping) instead of `tsx`, sidestepping an esbuild native-binary install that npm's script-blocking broke.
- **AI: switched from Anthropic to Groq** at the user's request (see §8). `@anthropic-ai/sdk` is still installed but now **unused (dead dependency)** — safe to remove.

---

## 4. Architecture & layering

Deliberate separation (spec §54/§55): UI / server actions / read queries / **pure finance logic** / validation / DB are distinct. Financial formulas live **only** in `lib/finance/*` and `lib/money.ts`, are pure (no Prisma), and are unit-tested.

```
lib/money.ts              Integer-paise money + Indian (₹, lakh/crore) formatting
lib/constants.ts          Account/txn/frequency type unions + asset↔liability classification (SQLite has no enums)
lib/finance/
  effects.ts                PURE balance engine: a transaction -> deltas to each account
  networth.ts               PURE net worth + liquid/investment/cash buckets
  spending.ts               PURE spending/income classification (by TYPE, never by sign)
  metrics.ts                PURE credit utilization, investment return, subscription monthly/annual
  recurrence.ts             PURE date math (advance/addMonths/daysUntil/nextByDayOfMonth), budget usage, projection
  goals.ts                  PURE goal progress, monthly contribution required, month-end forecast
lib/engine.ts             SERVER bridge: applies effects to Prisma inside a $transaction; exact reversal via recorded history
lib/db.ts                 Prisma client singleton
lib/user.ts               getCurrentUser / getSettings (single default user)
lib/audit.ts              writeAudit (audit log)
lib/queries.ts            Read layer: dashboard, accounts, account detail, transactions (+ filters)
lib/queries-p3.ts         Read layer: subscriptions, recurring, budgets, goals
lib/analytics.ts          Analytics engine: ranges, trends, comparison, merchant/category/account breakdowns, forecast
lib/ranges.ts             Prisma-free range constants (shared by the client range selector)
lib/snapshot.ts           Net-worth snapshots (write-on-read) + history read
lib/insights.ts           Deterministic financial insights (FACTS + labelled suggestions)
lib/notifications.ts      Deterministic in-app notifications (bell)
lib/ai-tools.ts           Read-only "getter" tools the AI may call + runTool executor
lib/backup.ts             Full backup builder + transactions CSV/JSON export
lib/csv.ts                PURE RFC-4180-ish CSV parse/serialize
lib/validation.ts         Zod schemas (rupee strings -> paise at the trust boundary)

app/actions/*.ts          Server actions (the write path the UI calls): accounts, transactions, categories,
                          subscriptions, recurring, budgets, goals, data (import/restore/settings/wipe)
app/api/ai/route.ts       AI assistant tool loop (Groq)
app/api/export/route.ts   CSV / JSON / full-backup downloads
app/(pages)               dashboard, accounts (+[id]), transactions, categories, subscriptions, budgets,
                          analytics, goals, assistant, settings
components/               UI primitives (components/ui/*), charts, forms, managers, dialogs, nav, quick-add
prisma/schema.prisma      Data model
prisma/seed.ts            Demo data (all flagged isDemo)
test/*.test.mts           Money engine, recurrence, goals, CSV tests
```

---

## 5. Data model (Prisma, SQLite)

SQLite has no enums, so `type`/`status`/`kind`/`frequency`/`reason` are **Strings** validated in app code against unions in `lib/constants.ts`. Money fields are `Int` (paise). Every row carries `userId`.

- **User** — the single default user ("You").
- **Account** — name, institution, type (18 types), currency, `balanceMinor` (asset value OR liability outstanding), includeInNetWorth, status (active/archived), icon, color; credit-card fields (`creditLimitMinor`, `statementDay`, `dueDay`, `minDueMinor`); `investedMinor`.
- **BalanceHistory** — previous/new/diff (paise), reason (INITIAL/MANUAL_UPDATE/TRANSACTION/RECONCILE), `transactionId?`. Powers per-account and net-worth charts.
- **Category** — name, kind (expense/income), `parentId?` (one level of subcategories), icon, color.
- **Transaction** — type, `amountMinor`, name, date, `accountId` (from), `toAccountId?`, `feeMinor?`, `categoryId?`, merchant, paymentMethod, tags, recurring, `subscriptionId?`.
- **AuditLog** — action, entity, entityId, before/after (JSON), timestamp.
- **Setting** — `autoUpdateBalances`, default account ids, currency, dateFormat, timezone.
- **Subscription** — amount, frequency, intervalDays?, startDate, nextBillingDate, lastChargedDate?, account?, category?, status (active/paused/cancelled), autoRenew.
- **RecurringTransaction** — type, amount, account (+to for transfers), category?, frequency, nextDate, lastRunDate?.
- **Budget** — `categoryId?` (null = overall), `amountMinor`. Unique per (userId, categoryId).
- **NetWorthSnapshot** — date, totalAssets/totalLiabilities/netWorth (paise).
- **SavingsGoal** — target/current (paise), targetDate?, linkedAccount?, priority, notes.

Migrations are in `prisma/migrations/` (init → phase3 → phase4).

---

## 6. The money engine (the correctness core)

This is the heart of the project — read this before touching any balance logic.

**Pure layer — `lib/finance/effects.ts`.** A transaction is modelled as **cash flows** first, then translated to stored deltas with one rule:
- asset account: `stored += cash` (more cash in the account)
- liability account: `stored -= cash` (cash IN pays down what you owe)

From that single rule, every type falls out correctly:

| Type | From account | To account | Counts as |
|---|---|---|---|
| EXPENSE | asset −amt / liability +amt (outstanding up) | — | spending |
| INCOME | asset +amt | — | income |
| TRANSFER | from −(amt+fee) | to +amt | neither (only the fee is spending) |
| CREDIT_CARD_PAYMENT | bank(asset) −amt | card(liability) −amt (outstanding down) | neither |
| BALANCE_ADJUSTMENT | set to target, record diff | — | neither |
| REFUND | asset +amt | — | negative spending |

**Server bridge — `lib/engine.ts`.** The only place transactions move balances. `applyTransaction` computes deltas and, for each touched account, updates `balanceMinor` **and** writes a matching `BalanceHistory` row, inside the same `prisma.$transaction` — so a balance and its history always move together. **Reversal (`reverseTransactionHistory`) undoes the exact recorded history rows and deletes them** — this guarantees an exact reversal for any type and is self-correcting when a transaction never moved balances (e.g. auto-update was off → no rows → nothing to undo).

**Edit = reverse-old-then-apply-new**, atomically, reusing those two functions (no separate edit-reversal logic).

**Classification is by `type`, never by sign** (`lib/finance/spending.ts`): spending = EXPENSE + transfer fees − REFUND; income = INCOME. Transfers and card payments are neither. Net worth = Σ assets − Σ liabilities over active, include-in-net-worth accounts.

**Why this matters:** it directly satisfies the spec's most important rule (§60) — the four money movements stay distinct, balances never corrupt or double-count.

---

## 7. Build phases (what was done, and the thinking)

The project was delivered in six phases matching the spec's own recommended order. The user drove one phase per message ("continue onto phase N"). Each phase ended green (tsc + eslint + tests + build) and, where money was involved, was verified against the live DB.

### Phase 1 — Foundation
**Thinking:** get the correctness-critical core right first; everything else layers on it. Also preserve the original spec verbatim so nothing is lost.
- Scaffolded Next.js (into a temp dir, then merged in to preserve the repo's existing config files).
- Prisma schema (User, Account, BalanceHistory, Category, Transaction, AuditLog, Setting) + first migration + a rich demo seed.
- Pure money engine + `node --test` covering the spec's §56 workflows (add/delete/edit expense, income, transfer w/ fee, credit-card purchase, credit-card payment, reconciliation, net worth, yearly→monthly).
- Accounts (list + detail, credit-card utilization), transactions (create/delete), a global **+ Add** quick-add, and a real dashboard (KPIs, charts, recent, largest).
- Light/dark/system theme, responsive (sidebar desktop / bottom nav mobile), empty/loading/error states, validation, confirm dialogs.

### Phase 2 — Categories, editing, filters, account analytics
**Thinking:** close the correctness gap (editing was deferred in P1) and add the depth the dashboard implies.
- Categories management page (CRUD + subcategories + icon/color). Deleting a category safely uncategorizes its transactions and promotes subcategories — no data loss.
- **Transaction editing (§24)** via reverse-old + apply-new; the four txn forms were refactored into one shared, edit-capable module so create and edit share a code path.
- Richer transaction filters: amount range, date range, recurring — on top of text/account/category/type.
- Account detail analytics: monthly money-in/out chart + spending-by-category, and inline editing.

### Phase 3 — Subscriptions, recurring, budgets, credit-card dues
**Thinking:** subscriptions/recurring are just scheduled transactions; reuse the create/apply engine path rather than inventing new money logic.
- Subscriptions: CRUD + pause + **"Record charge"** (creates the expense, applies the balance effect, advances next billing, guards duplicates, links the transaction via `subscriptionId`). Monthly-equivalent, annual cost, 7/30/90-day renewal windows, cost by category.
- Recurring transactions: any type, "Record now" posts the real transaction and advances the date.
- Budgets: overall + per-category (rolls up subcategories), with usage %, text status (normal/approaching/warning/exceeded) and projected month-end.
- Credit-card due tracking + dashboard cards (upcoming subscriptions, cards due).

### Phase 4 — Analytics, net-worth history, goals, forecasting
**Thinking:** snapshot net worth cheaply (on read) instead of wiring a scheduler into every mutation.
- **Net-worth snapshots** recorded once per day when you view the dashboard/analytics (idempotent), seeded with 7 monthly points.
- Analytics page: time ranges (7D…all + custom), spend/income trend (daily or monthly buckets), **comparison vs the previous equal period** (% deltas on headline metrics and categories), category / account / **merchant** breakdowns, net-worth movement, and a **month-end forecast** (this-month range).
- Savings goals: progress, remaining, required monthly contribution, target date; add/withdraw money.

### Phase 5 — AI assistant + insights
**Thinking:** keep the LLM safe and grounded — it may only call deterministic read-only "getter" functions, never touch the DB directly. Make the deterministic insights useful even without any API key.
- `lib/ai-tools.ts`: 10 read-only tools (`get_financial_summary`, `get_accounts`, `get_monthly_spending`, `get_category_breakdown`, `get_subscriptions`, `get_upcoming_payments`, `get_net_worth_history`, `get_budget_status`, `get_goals`, `get_transactions`) wrapping the existing query layer, amounts in rupees.
- AI route with a tool loop, a chat UI (`/assistant`) with suggested prompts, and a graceful "not configured" path when there's no key.
- **AI insights (§16):** deterministic FACTS (month-over-month spend, top category rise, largest expense, 3-month trend, subscriptions, net-worth change, budget usage) plus rule-based **suggestions**, shown on the dashboard, clearly separated ("facts, not AI guesses"). These need no API key.

### Phase 6 — Import/export, backup/restore, notifications, settings
**Thinking:** finish the "data ownership" story and the polish; keep exports as plain HTTP downloads, and restore by preserving ids so relations line up.
- Export: transactions CSV, transactions JSON, and a **full JSON backup** via `/api/export`.
- **CSV import**: upload → auto-mapped column selectors → preview → import as expense/income through the engine, skipping exact duplicates.
- **Backup/restore**: versioned dump; restore wipes and rebuilds in FK-safe order (categories two-phase, ids preserved).
- **Notifications (§47)**: deterministic bell (renewals, card dues, budget alerts, low balances, reached goals) with a count badge.
- **Settings hub (§35)**: auto-balance-update toggle, exports, CSV import, restore, an **audit trail (§26)**, and a danger-zone wipe.

---

## 8. AI assistant (Groq) details

Originally wired to Anthropic `claude-opus-5`, then **switched to Groq at the user's request** (OpenAI-compatible, so the tool loop uses OpenAI's function-calling shape).

- **Endpoint:** `POST https://api.groq.com/openai/v1/chat/completions`, `Authorization: Bearer $GROQ_API_KEY`.
- **Model:** the provided key did **not** have access to `llama-3.3-70b-versatile` (404). The models endpoint was queried and the default set to **`openai/gpt-oss-120b`** (tool-calling capable). Override via `GROQ_MODEL`.
- **Tool loop:** the Anthropic-shaped tool defs in `lib/ai-tools.ts` are converted to OpenAI `{type:"function", function:{...}}` at request time; `runTool` is provider-agnostic. Loop runs up to 8 tool rounds.
- **Free-tier rate limit:** 8,000 tokens/min. Each call ships the system prompt + all 10 tool schemas + tool results, so rapid back-to-back questions can 429. A **retry-on-429** (respects `retry-after`, capped) was added so single questions self-recover; heavy use needs a paid tier.
- **Verified live:** "financial summary" returned correct grounded numbers; "can I afford ₹30,000?" correctly called `get_financial_summary` + `get_upcoming_payments`, reasoned about liquid minus upcoming outflows, and answered yes with the math.

---

## 9. Verification done

- **30 unit tests** (`node --test`): money engine (all §56 workflows), recurrence/budget math, goals/forecast, CSV round-trip. All green.
- **Live end-to-end (28 checks):** a temporary route drove the **real server actions** (as the UI does) against the live DB and asserted the spec's Workflow A–E, edit (§24) and delete (§23) correctness through the full server → engine → DB → dashboard-read path — all passed, then the route was removed and the demo re-seeded.
- **DB integration mirrors:** create+reverse (credit-card payment), edit-with-account-change, subscription charge, and a full **backup → wipe → restore round-trip** (all counts + net worth identical, FK integrity intact).
- **Groq** verified with real calls (above).
- Every phase ended with `tsc --noEmit` = 0, `eslint` = 0, `next build` clean.

---

## 10. Known gaps & limitations (honest)

Nothing here breaks the money core, which is verified. But for a fresh agent's awareness:

**Functional**
- **Undo (§25) is minimal** — recovery is the audit trail + exact delete/edit reversal + backup/restore, not a one-click undo stack.
- **Recurring/subscriptions are manual-trigger** — "Record charge"/"Record now" buttons exist; nothing auto-posts a due charge on its date (no background job).
- **No Investments page (§11/§46)** — its nav item still shows **Soon**. P/L is on the account detail + dashboard bucket.
- **Reconciliation (§21) has no diff preview** — "Update balance" records history (functionally reconciles) but doesn't show app-vs-actual difference first.

**Wired-but-incomplete**
- **Settings stored, not applied:** `timezone` and `dateFormat` are saved but date handling still uses local time + hardcoded `en-IN`; default expense/income account prefs exist in the schema but don't prefill Quick-Add. (These are displayed read-only, not fake buttons.)
- **Notifications** recompute each page load (no dismiss/persistence) and omit "unusually large transaction" (needs a baseline).
- **CSV import** handles EXPENSE/INCOME only (not transfers/CC) and skips duplicates silently rather than flagging them in the preview.
- **AI insights** are deterministic only; the optional "rewritten by AI" is not wired.
- **Comparison mode (§43)** is vs-previous-period %, not explicit side-by-side "This Year vs Last Year".

**By design (confirmed with the user)**
- **No authentication (§39)** — single-user; `userId` everywhere so multi-user is a later add.
- **INR only (§27)** — `currency` column exists, no conversion.
- Optional transaction fields not built: attachment/reference, location, arbitrary custom metadata, tag-filter UI.

**Testing thin spots:** no automated tests for CSV import/restore or the AI route (validated manually); accessibility not audited.

**Dead dependency:** `@anthropic-ai/sdk` is installed but unused after the Groq switch — safe to `npm remove`.

---

## 11. Gotchas & lessons (environment/tooling)

Real issues hit this session — a fresh agent will likely hit them too:

- **npm cache is root-owned (`EACCES`).** `~/.npm` had root-owned files. Fix used: install with `--cache <writable dir>` pointing into the scratchpad. `sudo` isn't available.
- **npm 11 blocks lifecycle scripts** ("allow-scripts" warnings). Prisma's engines still downloaded despite this, but it's why `tsx`/esbuild were avoided for the seed.
- **Prisma 7 → 6 downgrade.** Prisma 7 removed in-schema `url` and needs a driver adapter (native `better-sqlite3`) — incompatible with the blocked build scripts. Use Prisma 6.
- **Next 16 auto-writes a managed block into `AGENTS.md`** on `next dev`. Set `agentRules: false` in `next.config.ts` and restore `AGENTS.md`. Also, `create-next-app` ships its own `AGENTS.md`/`CLAUDE.md`/`README.md` — when merging a scaffold into an existing repo, restore the tracked ones from git.
- **`node --test` with TypeScript:** needs `"type": "module"` (package.json), `allowImportingTsExtensions: true` (tsconfig), `.ts` extensions on internal lib-to-lib imports, and test files as `*.test.mts`. Pure finance libs must not import Prisma so they stay runnable under type-stripping.
- **React 19 lint rule `react-hooks/set-state-in-effect`** flags the classic "reset state in an effect" pattern. Fixes used: CSS-driven icon swap for the theme toggle; a remount `key` for dialogs instead of an effect.
- **App-router private folders:** a folder starting with `_` (e.g. `app/api/_e2e`) is **not routed**. Use a non-underscore name.
- **Groq specifics:** this key lacks `llama-3.3-70b-versatile`; query `GET /openai/v1/models` to see what's available; `openai/gpt-oss-120b` works. Free tier is 8,000 TPM → retry-on-429.

---

## 12. Security & current git state

- **The Groq API key was never committed.** It lives only in the untracked, **gitignored** `.env`. Verified: `git log -- .env` (never committed), `git log -S'gsk_'` and `git grep 'gsk_'` across all history (no blob in any commit), `git ls-files --error-unmatch .env` (not tracked). `.env.example` is clean. `prisma/dev.db` (demo data) is also gitignored.
- **Recommendation:** rotate the Groq key anyway (it was pasted in plaintext into a chat). Regenerate in the Groq console, update `.env` locally.
- **Repo is safe to make public.** The work is committed and the tree is clean.

**Commits (newest first):** `5d1e29b ai added` · `6bcc2de Phase 6 paint` · `db94035 Phase 5 roof` · `ff4bc41 Phase 4 bricks` · `e6635ac Phase 3 layer` · `34c78c4 Phase 2 found` · `3ee8745 Phase 1 foundation` · `4279a62 AI Setup`. Working tree clean at handoff time.

> Note: commit messages ("bricks", "roof", "paint") are the owner's; the "Phase N" numbering there roughly tracks — but treat this document's phase descriptions as authoritative for what each phase contains.

---

## 13. Suggested next steps (highest value first)

1. **Rotate the Groq key** and remove the dead `@anthropic-ai/sdk` dependency.
2. **Investments page (§11)** — reuse existing account data (invested vs current, P/L); flip the nav item off "Soon". Low effort, visible.
3. **Auto-post due recurring/subscriptions on read** — same "write-on-read" trick as net-worth snapshots: when the dashboard loads, generate any subscription/recurring charges whose date has passed (idempotent via `lastChargedDate`/`lastRunDate`), instead of requiring the manual button.
4. **Reconcile diff dialog (§21)** — show tracked vs actual and the difference before confirming a balance update.
5. **Wire the stored settings** — apply `dateFormat`/`timezone`, and use default expense/income accounts to prefill Quick-Add.
6. Broaden automated tests to cover CSV import and restore.

---

## 14. Where to look first (orientation for a fresh agent)

- Understand the money rules: `lib/finance/effects.ts`, then `lib/engine.ts`, then any file in `app/actions/`.
- Understand a page: it's a server component in `app/**/page.tsx` calling a function in `lib/queries*.ts` / `lib/analytics.ts`, rendering client components from `components/`.
- Understand the AI: `lib/ai-tools.ts` (what the model can see) + `app/api/ai/route.ts` (the loop).
- The full product spec is `docs/finance-spec.md`. The design conventions are also summarized in `README.md`.
