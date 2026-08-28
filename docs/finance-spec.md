# AI Personal Finance Dashboard — Full Project Specification

> Verbatim copy of the original project specification prompt, preserved so it can be re-accessed with zero quality loss. Do not edit or summarize this file.

Build a polished, modern **AI-powered Personal Finance Dashboard** inside this project directory.

The application should act as a centralized personal financial command center where I can manually track all of my money across different banks, wallets, investment platforms, cash accounts, credit cards, subscriptions, expenses, income, and other financial accounts.

The primary goal is to answer questions such as:

* How much money do I currently have?
* Where is my money stored?
* How much have I spent this month?
* Which account did each expense come from?
* What categories am I spending the most on?
* How much am I paying in subscriptions?
* What subscriptions are renewing soon?
* How much money will I likely have at the end of the month?
* How has my net worth changed over time?
* Which accounts are increasing or decreasing?
* What are my biggest unnecessary expenses?
* What financial trends should I be aware of?
* Am I spending more than usual?
* How much money is actually liquid and available to spend?

This is primarily a **manual-entry personal finance application** initially. Do not depend on bank APIs or automatic banking integrations for the core functionality.

The architecture should, however, be clean enough that automatic account syncing could be added in the future.

---

# 1. Core Dashboard

The main dashboard should provide an immediate overview of my entire financial situation.

At the top, prominently display:

* Total Net Worth
* Total Liquid Balance
* Total Investments
* Total Cash
* Total Credit Card Outstanding
* Total Debt/Liabilities
* Income This Month
* Spending This Month
* Net Cash Flow This Month
* Upcoming Subscription Charges

Net worth should approximately be calculated as:

Net Worth =
Cash + Bank Accounts + Wallets + Investments + Other Assets
− Credit Card Outstanding
− Loans
− Other Liabilities

Allow individual accounts to optionally be excluded from net-worth calculations.

Example:

If I have:

ICICI Bank = ₹50,000
HDFC Bank = ₹25,000
Crypto = ₹90,000
Stocks = ₹40,000
Cash = ₹5,000
Credit Card Outstanding = ₹10,000

Net Worth should show:

₹2,00,000

The dashboard should also show useful visualizations such as:

* Net worth over time
* Monthly income vs spending
* Spending by category
* Spending by account
* Account balance distribution
* Subscription spending
* Recent transactions
* Largest expenses this month
* Upcoming recurring payments
* Month-to-month spending comparison

Charts should be interactive where reasonable.

---

# 2. Accounts

Create a complete account management system.

I should be able to add accounts for different places where money is stored or owed.

Possible account types:

* Bank Account
* Savings Account
* Current Account
* Cash
* Digital Wallet
* UPI Wallet
* Credit Card
* Investment Account
* Stocks
* Mutual Funds
* Crypto
* Fixed Deposit
* Recurring Deposit
* Loan
* Buy Now Pay Later
* Other Asset
* Other Liability
* Custom

Each account should support:

* Account Name
* Institution / Platform
* Account Type
* Current Balance
* Currency
* Optional account nickname
* Optional description
* Optional icon
* Optional color
* Include in net worth: Yes/No
* Account status: Active / Archived
* Created date
* Last updated date

For example:

Account Name: ICICI Savings
Institution: ICICI Bank
Type: Bank Account
Balance: ₹54,350

Another:

Account Name: Binance
Institution: Binance
Type: Crypto
Balance: ₹92,400

Another:

Account Name: ICICI Coral
Type: Credit Card
Outstanding Balance: ₹12,350

For liability-type accounts such as credit cards and loans, balances should reduce net worth rather than increase it.

---

# 3. Manual Balance Updates

I need to be able to manually update account balances whenever I want.

When a balance changes, do NOT simply overwrite the previous value without preserving history.

Create a balance-history system.

Every balance update should record:

* Account
* Previous Balance
* New Balance
* Difference
* Date
* Time
* Optional note

This enables historical graphs.

Example:

August 1:
ICICI = ₹40,000

August 15:
ICICI = ₹52,000

August 28:
ICICI = ₹46,500

The system should preserve these values and allow charts showing how that account's balance changed.

Provide a quick-edit feature directly from the dashboard so I can update balances without navigating through multiple pages.

---

# 4. Transactions / Spending

Create a detailed transaction system.

I should be able to manually add expenses.

Every expense should contain:

* Amount
* Transaction Name
* Description / Notes
* Date
* Time
* Category
* Subcategory
* Account used
* Merchant
* Payment method
* Tags
* Recurring: Yes/No
* Optional attachment/reference
* Optional location
* Optional custom metadata

Example:

Amount: ₹899
Name: Dinner
Category: Food
Account: ICICI Savings
Payment Method: UPI
Merchant: Zomato
Date: August 28, 2026

When an expense is added, the application should optionally automatically subtract the amount from the selected account balance.

Example:

ICICI balance before transaction:
₹50,000

Expense:
₹1,000

ICICI balance after:
₹49,000

There should be a setting controlling whether transactions automatically modify account balances.

Avoid accidental double-counting if I manually update a balance after transactions have already modified it.

---

# 5. Income Transactions

Income should work similarly to expenses.

Allow income entries with:

* Amount
* Source
* Account received into
* Date
* Income category
* Description
* Tags
* Recurring status

Example categories:

* Salary
* Pocket Money
* Freelance
* Business
* Investment Profit
* Interest
* Dividend
* Refund
* Gift
* Sale
* Other

Income should optionally automatically increase the selected account balance.

---

# 6. Transfers Between Accounts

Transfers are extremely important.

Create a dedicated transfer transaction type.

Example:

Transfer ₹10,000 from ICICI Bank to HDFC Bank.

This should:

Subtract ₹10,000 from ICICI.

Add ₹10,000 to HDFC.

BUT:

It must NOT count ₹10,000 as spending.

It must NOT count ₹10,000 as income.

It should only represent money moving internally.

Transfers should support:

* From Account
* To Account
* Amount
* Date
* Notes
* Optional transfer fee

If a transfer fee exists, only the fee should count as an expense.

---

# 7. Expense Categories

Provide sensible default categories.

Examples:

Food

* Restaurants
* Delivery
* Groceries
* Snacks

Transport

* Fuel
* Uber/Ola
* Public Transport
* Parking
* Vehicle Maintenance

Shopping

* Electronics
* Clothing
* Accessories
* Online Shopping

Entertainment

* Games
* Movies
* Streaming
* Events

Subscriptions

* Software
* AI Tools
* Streaming
* Gaming
* Cloud Storage

Bills

* Electricity
* Internet
* Mobile
* Rent
* Utilities

Health

* Medicines
* Doctor
* Fitness

Education

* Courses
* Books
* Tuition

Investments

* Stocks
* Mutual Funds
* Crypto

Other

* Gifts
* Fees
* Miscellaneous

Allow users to:

* Add categories
* Rename categories
* Delete categories
* Add subcategories
* Assign icons
* Assign colors

---

# 8. Subscription Management

Create a dedicated Subscription Manager.

I should be able to add services I pay for regularly.

Each subscription should contain:

* Subscription Name
* Provider
* Amount
* Billing Frequency
* Start Date
* Next Billing Date
* Account charged
* Category
* Status
* Auto-renew enabled
* Notes

Supported frequencies:

* Weekly
* Monthly
* Every 2 months
* Quarterly
* Every 6 months
* Yearly
* Custom interval

For example:

ChatGPT Plus
₹1,999/month
Account: ICICI Credit Card

Google AI Pro
₹1,950/month
Account: HDFC Credit Card

Domain Renewal
₹1,200/year

Calculate:

Monthly Subscription Cost

Annual Subscription Cost

Upcoming Renewals

Subscriptions renewing in:

* Next 7 days
* Next 30 days
* Next 90 days

Convert yearly subscriptions into a monthly-equivalent cost.

Example:

₹12,000/year

Monthly equivalent:

₹1,000/month

The dashboard should show:

"You currently spend approximately ₹X/month or ₹Y/year on subscriptions."

---

# 9. Subscription Transaction Creation

When a subscription renewal date arrives, the system should be capable of creating a corresponding transaction.

Example:

ChatGPT Plus renews.

Create:

Expense = ₹1,999
Category = Subscription
Account = ICICI Credit Card
Merchant = OpenAI

Do not repeatedly create duplicate transactions.

Maintain a record of generated renewal transactions.

---

# 10. Credit Cards

Credit cards should behave differently from normal bank accounts.

For a credit card, track:

* Credit Limit
* Current Outstanding
* Available Credit
* Statement Date
* Payment Due Date
* Minimum Due
* Billing Cycle
* Optional annual fee

Calculate:

Available Credit =
Credit Limit − Outstanding Balance

Credit Utilization =
Outstanding / Credit Limit × 100

Show warnings when utilization becomes high.

Example:

Limit = ₹50,000

Outstanding = ₹12,500

Utilization = 25%

A purchase made using a credit card should increase credit card outstanding.

A credit-card payment from a bank account should:

Decrease bank balance.

Decrease credit-card outstanding.

It should NOT count the credit-card payment itself as another expense because the original purchases already count as spending.

---

# 11. Investments

Investment accounts should support manual balances.

Types may include:

* Stocks
* Mutual Funds
* Crypto
* Fixed Deposits
* Gold
* Bonds
* Other Investments

At minimum track:

* Current value
* Invested amount
* Profit/Loss
* Profit/Loss percentage

Formula:

Profit/Loss =
Current Value − Invested Amount

Profit % =
Profit / Invested Amount × 100

Allow manual updates.

A future API integration can be added later, but it should not be required now.

---

# 12. Monthly Budgets

Allow budgets to be created globally or by category.

Examples:

Food: ₹8,000/month

Entertainment: ₹3,000/month

Shopping: ₹5,000/month

Subscriptions: ₹5,000/month

Show:

Amount spent

Budget remaining

Percentage used

Expected end-of-month spending

Visual warnings:

0–70% = normal

70–90% = approaching budget

90–100% = warning

100%+ = exceeded

Do not rely only on color; also show text/status indicators for accessibility.

---

# 13. Monthly Financial Summary

Create a monthly summary page.

It should show:

Starting Net Worth

Ending Net Worth

Net Worth Change

Total Income

Total Spending

Net Cash Flow

Savings Rate

Largest Expense

Most Expensive Category

Most Used Account

Subscription Spending

Investment Change

Average Daily Spending

Number of Transactions

Savings rate can be approximately:

(Income − Spending) / Income × 100

Handle months with zero income gracefully.

---

# 14. Transaction Search and Filtering

The transactions page should support powerful filtering.

Allow filters by:

* Date
* Month
* Account
* Category
* Subcategory
* Merchant
* Transaction Type
* Amount Range
* Tags
* Recurring Status

Provide text search.

Examples:

"show all Zomato transactions"

"show expenses above ₹5,000"

"show all transactions from ICICI"

"show gaming purchases from August"

---

# 15. AI Financial Assistant

A major part of the project should be an AI assistant that can analyze the data stored in the application.

The AI should NOT invent financial information.

It should base answers only on actual stored financial data.

Example user questions:

"How much did I spend this month?"

"What did I spend the most money on?"

"Which subscriptions cost me the most?"

"How much did I spend on food compared to last month?"

"Where is most of my money stored?"

"Can I afford a ₹30,000 purchase?"

"What are my unnecessary expenses?"

"How much money am I likely to have by next month?"

"Which account did I use the most?"

"How has my net worth changed over the last 6 months?"

"What subscriptions could I consider cancelling?"

"Why did my spending increase this month?"

"Give me a financial summary."

"How much money do I spend per day on average?"

"Show my biggest transactions."

The AI assistant should have access to structured financial summaries generated by backend functions.

Avoid giving the LLM unrestricted direct database modification access.

Use tools/functions such as:

getAccounts()

getTransactions()

getMonthlySpending()

getCategoryBreakdown()

getSubscriptions()

getUpcomingPayments()

getNetWorthHistory()

getBudgetStatus()

getFinancialSummary()

This keeps the AI analysis deterministic and safe.

---

# 16. AI Insights

Automatically generate useful insights based on deterministic calculations, optionally rewritten by AI.

Examples:

"Your food spending is 23% higher than last month."

"You spent ₹7,400 on subscriptions this month."

"Your largest expense was ₹18,000 on Electronics."

"Your monthly spending has increased for three consecutive months."

"You have ₹6,850 worth of subscriptions renewing within the next 30 days."

"Your average daily spending this month is ₹1,280."

"Your net worth increased by 8.4% over the last 3 months."

"You have used 84% of your entertainment budget."

AI insight generation should clearly distinguish between:

FACTS

and

AI suggestions/predictions.

---

# 17. Financial Forecasting

Create basic forecasting without pretending predictions are guaranteed.

Forecast:

Expected end-of-month expenses

Expected recurring expenses

Expected account balance

Expected cash flow

Use historical transaction averages and known recurring expenses.

Example:

Current spending this month:
₹32,000

Average daily spending:
₹1,200

Days remaining:
8

Estimated additional variable spending:
₹9,600

Upcoming subscriptions:
₹3,000

Expected month-end spending:
₹44,600

Clearly label forecasts as estimates.

---

# 18. Net Worth History

Store historical net-worth snapshots.

Possible snapshots:

* Daily
* Whenever balances change
* Manual snapshot

Each snapshot should contain:

Date

Total Assets

Total Liabilities

Net Worth

This powers historical charts.

---

# 19. Recurring Transactions

Besides subscriptions, support arbitrary recurring transactions.

Examples:

Pocket money

Salary

Rent

SIP

Insurance

EMI

Internet

Gym membership

Allow recurrence rules such as:

Daily

Weekly

Monthly

Quarterly

Yearly

Custom

---

# 20. Savings Goals

Allow users to create financial goals.

Examples:

Laptop: ₹2,00,000

Emergency Fund: ₹1,00,000

Car: ₹10,00,000

Vacation: ₹1,50,000

Fields:

Goal Name

Target Amount

Current Saved Amount

Target Date

Linked Account

Priority

Notes

Calculate:

Progress %

Remaining Amount

Monthly Contribution Required

Estimated Completion Date

---

# 21. Account Reconciliation

Manual finance tracking can drift over time.

Provide a reconciliation feature.

Example:

App thinks ICICI balance is:

₹48,420

Actual balance:

₹47,900

Difference:

−₹520

Allow me to reconcile it.

Create a balance adjustment transaction or history entry rather than silently changing historical data.

---

# 22. Data Integrity

Financial calculations must be deterministic.

Do NOT use floating-point arithmetic for money.

Store monetary values in the smallest currency unit when appropriate.

For INR:

₹123.45 = 12345 paise.

Or use a proper Decimal type depending on the stack/database.

Avoid JavaScript floating-point errors such as:

0.1 + 0.2 !== 0.3

Financial calculations must remain accurate.

---

# 23. Deleting Transactions

Deleting a transaction that previously modified an account balance must correctly reverse that change.

Example:

₹1,000 expense added.

Balance:

₹50,000 → ₹49,000

Delete transaction.

Balance should return:

₹50,000

The same principle applies to:

Income

Transfers

Credit-card payments

Recurring transactions

Avoid balance corruption.

---

# 24. Editing Transactions

Editing an existing transaction should correctly recalculate affected account balances.

Example:

Expense originally:

₹1,000 from ICICI

Changed to:

₹1,500 from HDFC

Correct behavior:

Restore ₹1,000 to ICICI.

Subtract ₹1,500 from HDFC.

Do not simply modify the database row without fixing balances.

---

# 25. Undo System

For important financial actions, provide undo where reasonable.

Examples:

Deleted transaction

Changed balance

Deleted account

Reconciliation

A simple audit-history based restore system is acceptable.

---

# 26. Audit Log

Maintain a lightweight audit log.

Track events such as:

Account created

Account deleted

Balance changed

Transaction created

Transaction edited

Transaction deleted

Subscription changed

Budget updated

Reconciliation performed

Record:

Timestamp

Action

Affected entity

Previous state when reasonable

New state

---

# 27. Currency

Default currency should be:

INR ₹

Use Indian number formatting.

Examples:

₹1,000

₹25,000

₹1,50,000

₹12,50,000

₹1.25 Cr

However, architect the app so other currencies can eventually be supported.

---

# 28. Date Handling

Use proper date handling.

Financial entries should preserve:

Transaction date

Created timestamp

Updated timestamp

Timezone

Recurring payment dates

Default timezone should be configurable.

Do not rely solely on browser-local date parsing.

---

# 29. Dashboard UX

The dashboard should feel like a premium modern fintech product rather than an admin panel.

Use a clean card-based UI.

Prioritize information hierarchy.

Example layout:

TOP:

Net Worth

Monthly Spending

Monthly Income

Cash Flow

NEXT:

Net Worth chart

Income vs Expenses chart

NEXT:

Accounts

Upcoming Subscriptions

NEXT:

Spending Categories

Recent Transactions

NEXT:

AI Financial Insights

Avoid excessive visual clutter.

---

# 30. Navigation

Suggested navigation:

Dashboard

Accounts

Transactions

Subscriptions

Budgets

Investments

Goals

Analytics

AI Assistant

Settings

Navigation should be responsive.

Desktop:

Sidebar navigation.

Mobile:

Collapsible navigation or bottom navigation where appropriate.

---

# 31. Quick Add

Create a prominent "+ Add" button.

Clicking it should allow:

Add Expense

Add Income

Transfer Money

Update Balance

Add Subscription

Add Account

This should be accessible from almost anywhere in the application.

---

# 32. Fast Expense Entry

Expense entry should be optimized for speed.

Ideally I should be able to enter an expense in a few seconds.

Primary fields shown immediately:

Amount

Account

Category

Description

Date

Additional advanced fields can be hidden behind:

"More Options"

---

# 33. Responsive Design

The dashboard must work properly on:

Desktop

Laptop

Tablet

Mobile

Do not build a desktop-only UI.

Tables should gracefully adapt on mobile.

---

# 34. Dark Mode

Support:

Light Mode

Dark Mode

System Theme

Persist preference.

---

# 35. Settings

Create settings for:

Default Currency

Timezone

Date Format

Theme

Default Expense Account

Default Income Account

Automatic Balance Updates

Net Worth Snapshot Frequency

AI Features

Financial Forecasting

Notification Preferences

Archived Accounts

Data Backup

---

# 36. Import / Export

Allow financial data export.

At minimum:

CSV

JSON

Potential later support:

Excel

Allow transaction CSV import.

Before committing an import:

Show preview.

Detect columns.

Allow column mapping.

Detect obvious duplicates.

Ask for confirmation.

---

# 37. Backup

Provide an easy way to export a complete backup of the app.

The backup should contain:

Accounts

Balance History

Transactions

Subscriptions

Budgets

Goals

Settings

Categories

Audit History

Allow restoring from a valid backup.

---

# 38. Privacy and Security

This application handles financial information.

Treat privacy seriously.

Do NOT:

Expose secrets in frontend code.

Log sensitive financial data unnecessarily.

Send complete financial history to external services without reason.

If AI APIs are used, send only the minimum data necessary for a request.

Keep API keys server-side.

Use environment variables.

Include an `.env.example`.

Never commit real secrets.

---

# 39. Authentication

If authentication is included, support a simple secure user system.

At minimum:

Sign in

Sign out

Protected routes

Session handling

Password hashing if storing passwords directly

Since this may initially be a private single-user dashboard, authentication can remain lightweight but architecture should not prevent multi-user support later.

Every database object should preferably include a userId/ownerId where appropriate.

---

# 40. Database Design

Create a clean relational database structure.

Likely tables/models:

User

Account

BalanceHistory

Transaction

Category

Subscription

RecurringTransaction

Budget

SavingsGoal

NetWorthSnapshot

AuditLog

Setting

AIConversation

AIInsight

Potential relationships:

User
→ Accounts

User
→ Transactions

Account
→ Transactions

Account
→ BalanceHistory

Category
→ Transactions

Subscription
→ Transactions

User
→ Budgets

User
→ Goals

User
→ NetWorthSnapshots

---

# 41. Transaction Types

Use explicit transaction types.

Examples:

EXPENSE

INCOME

TRANSFER

CREDIT_CARD_PAYMENT

BALANCE_ADJUSTMENT

INVESTMENT

REFUND

Do not infer transaction type solely from whether an amount is positive or negative.

---

# 42. Analytics

Create a dedicated analytics page.

Allow selecting time ranges:

7 Days

30 Days

This Month

Last Month

3 Months

6 Months

1 Year

All Time

Custom Range

Analytics should include:

Spending trend

Income trend

Net cash flow trend

Category breakdown

Account usage

Merchant breakdown

Subscription expenses

Largest expenses

Average transaction size

Average daily spending

Net-worth movement

Savings rate

---

# 43. Comparison Mode

Allow comparing periods.

Examples:

This Month vs Last Month

Last 30 Days vs Previous 30 Days

This Year vs Last Year

Show percentage changes.

Example:

Food

July:
₹8,500

August:
₹10,400

Change:
+22.35%

---

# 44. Merchant Analytics

Track merchant/provider names.

Examples:

Amazon

Zomato

Swiggy

Steam

OpenAI

Google

Uber

Display:

Total spent with merchant

Number of transactions

Average transaction

Last transaction

Monthly spending trend

---

# 45. Account Analytics

Each account should have its own detail page.

Show:

Current Balance

Balance History

Transactions

Money In

Money Out

Most common categories

Monthly activity

Last updated

Account-specific spending

---

# 46. Subscription Analytics

Display useful subscription metrics:

Number of active subscriptions

Monthly subscription equivalent

Annual subscription cost

Most expensive subscription

Renewals this month

Subscriptions by category

Price increases if subscription cost changes over time

---

# 47. Notifications

Support in-app notifications.

Examples:

Subscription renews tomorrow.

Credit-card due date approaching.

Budget 90% used.

Unusually large transaction entered.

Account balance low.

Savings goal reached.

Recurring transaction due.

---

# 48. Empty States

Pages without data should not look broken.

Examples:

No transactions yet.

Display:

"No transactions yet. Add your first expense or income to begin tracking your finances."

Provide a relevant CTA button.

---

# 49. Loading and Error States

Every asynchronous operation should have proper:

Loading UI

Error handling

Retry states where appropriate

Success confirmation

Do not leave silent failures.

---

# 50. Form Validation

Validate all financial forms.

Examples:

Transaction amount must be greater than zero.

Account must exist.

Transfer source and destination cannot be identical.

Credit limit cannot be negative.

Subscription frequency must be valid.

Dates must be valid.

Provide friendly error messages.

---

# 51. Confirmation Dialogs

Use confirmation dialogs for destructive actions such as:

Delete Account

Delete Transaction

Delete Subscription

Delete All Data

Restore Backup

Reconciliation

Avoid accidental financial-history destruction.

---

# 52. Accessibility

Ensure:

Keyboard navigation

Good contrast

Visible focus states

Accessible form labels

Icons are not the only indicators

Charts have readable labels

Buttons have clear names

---

# 53. Performance

Avoid unnecessary re-fetching.

Use proper database indexes for:

userId

accountId

transaction date

category

transaction type

subscription nextBillingDate

Analytics calculations should remain fast as transaction count increases.

---

# 54. Code Quality

Before implementing features, inspect the existing project structure.

Use the conventions, framework, package manager, UI system, database, and coding patterns already present in the repository where reasonable.

Do NOT unnecessarily replace working infrastructure.

Keep the code:

Modular

Typed

Readable

Maintainable

Testable

Avoid giant components.

Separate:

UI

Business logic

Database logic

Financial calculations

AI logic

Validation

---

# 55. Financial Logic Layer

Create centralized reusable financial calculation utilities/services.

For example:

calculateNetWorth()

calculateAccountBalance()

calculateMonthlySpending()

calculateMonthlyIncome()

calculateCashFlow()

calculateSavingsRate()

calculateSubscriptionMonthlyEquivalent()

calculateSubscriptionAnnualCost()

calculateBudgetUsage()

calculateCreditUtilization()

calculateInvestmentReturn()

calculateForecast()

Do not duplicate financial formulas throughout UI components.

---

# 56. Testing

Financial logic is critical.

Write tests for at least the important calculations and transaction workflows.

Test scenarios such as:

Adding an expense.

Deleting an expense.

Editing an expense amount.

Changing expense account.

Adding income.

Creating a transfer.

Deleting a transfer.

Credit-card purchase.

Credit-card payment.

Subscription renewal.

Balance reconciliation.

Net-worth calculation.

Budget calculation.

Yearly-to-monthly subscription conversion.

Do not rely exclusively on UI testing.

---

# 57. Demo / Seed Data

Provide optional realistic seed/demo data so the UI can be tested.

Example accounts:

ICICI Savings

HDFC Savings

Cash

ICICI Credit Card

Stocks

Mutual Funds

Crypto

Example transactions should populate multiple months so analytics charts have meaningful data.

Demo data should be clearly separable from real user data.

---

# 58. README

Create/update README.md with:

Project overview

Features

Tech stack

Installation

Environment variables

Development commands

Database setup

Migration instructions

Seed instructions

AI configuration

Build instructions

Architecture overview

Important financial calculation conventions

---

# 59. Development Approach

Do not try to build the entire application as one enormous component.

Implement in logical phases.

Recommended order:

PHASE 1

Inspect project architecture.

Create/update database schema.

Create account system.

Create transactions.

Implement reliable balance calculations.

PHASE 2

Dashboard.

Categories.

Account pages.

Transaction filtering.

Transfers.

PHASE 3

Subscriptions.

Recurring transactions.

Credit cards.

Budgets.

PHASE 4

Analytics.

Net worth history.

Savings goals.

Forecasting.

PHASE 5

AI assistant.

AI insights.

Advanced analytics.

PHASE 6

Import/export.

Backups.

Notifications.

Polish.

Testing.

---

# 60. Most Important Rule

Financial correctness is more important than visual features.

Never allow UI convenience to create corrupted balances or double-counted transactions.

The following distinction must always remain clear:

EXPENSE = money actually spent.

INCOME = external money received.

TRANSFER = money moved between my own accounts.

CREDIT CARD PAYMENT = paying an existing liability.

BALANCE ADJUSTMENT = reconciling tracked values with reality.

INVESTMENT PURCHASE = usually asset reallocation rather than ordinary consumption.

Correctly modeling these is essential.

---

# 61. UX Examples

I should be able to perform workflows such as:

### Workflow A — Add normal expense

I spent ₹500 on food using ICICI.

Click:

* Add → Expense

Enter:

₹500

Food

ICICI

Save.

Dashboard immediately updates:

ICICI balance

Monthly spending

Food spending

Cash flow

Recent transactions

Analytics

---

### Workflow B — Transfer money

Transfer ₹20,000:

ICICI → HDFC.

ICICI decreases ₹20,000.

HDFC increases ₹20,000.

Net worth does not change.

Income does not change.

Spending does not change.

---

### Workflow C — Credit-card purchase

Buy headphones for ₹10,000 using ICICI Credit Card.

Monthly spending increases:

₹10,000.

Credit-card outstanding increases:

₹10,000.

Net worth decreases:

₹10,000.

---

### Workflow D — Pay credit-card bill

Pay ₹10,000 credit-card bill using ICICI Savings.

Bank balance:

−₹10,000.

Credit-card outstanding:

−₹10,000.

Net worth should remain essentially unchanged at the moment of repayment because the liability and cash both decrease equally.

Do NOT count another ₹10,000 expense.

---

### Workflow E — Subscription

Add:

ChatGPT Plus

₹1,999/month

ICICI Credit Card

Renewal: September 1.

Dashboard should show upcoming renewal and monthly subscription totals.

When renewal occurs, create the corresponding subscription expense once.

---

# 62. UI Quality Target

Aim for a visual quality comparable to modern products such as:

Monarch Money

Copilot Money

Revolut

Linear

Stripe Dashboard

Modern fintech dashboards

Do NOT directly copy their branding.

Use them only as inspiration for:

Spacing

Typography

Hierarchy

Charts

Cards

Navigation

Interaction quality

The application should feel intentionally designed rather than looking like a generic generated CRUD dashboard.

---

# 63. Avoid Fake Functionality

Do not create buttons that do nothing.

Do not hardcode financial statistics that should come from data.

Do not show placeholder charts pretending to contain real information.

Do not create fake AI responses.

If a feature is not implemented yet, clearly mark it as unavailable instead of pretending it works.

---

# 64. AI Coding Instructions

Before modifying code:

1. Inspect the entire relevant project structure.
2. Identify the existing stack and architecture.
3. Inspect package.json and important config files.
4. Inspect the database/schema if present.
5. Inspect existing components and styling.
6. Reuse existing architecture where appropriate.
7. Produce a concise implementation plan internally.
8. Then implement the feature.

When editing:

* Prefer modifying existing files when appropriate.
* Create new abstractions when they genuinely improve maintainability.
* Do not rewrite unrelated working code.
* Do not unnecessarily change dependencies.
* Do not remove existing features unless they conflict with this specification.
* Fix TypeScript/compiler/linter errors introduced by your work.
* Ensure imports resolve correctly.
* Keep database migrations safe.
* Do not silently delete user data.

After implementing:

* Run available type checks.
* Run linting where configured.
* Run relevant tests.
* Run/build the application where possible.
* Fix issues found before considering the work complete.

---

# 65. Final Product Goal

The finished product should function as my personal financial operating system.

I should be able to open it and immediately understand:

1. Exactly how much money I have.
2. Exactly where that money is.
3. How much I owe.
4. What I spent recently.
5. Which account each transaction came from.
6. What recurring expenses are coming.
7. How much I spend on subscriptions.
8. Whether spending is increasing or decreasing.
9. How my net worth is changing.
10. Whether I am staying within budgets.
11. How close I am to financial goals.
12. What financial patterns AI can identify from my actual data.

Prioritize:

**Financial accuracy → data integrity → usability → analytics → AI → visual polish.**

Do not sacrifice accounting correctness for flashy UI.
