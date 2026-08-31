-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "institution" TEXT,
    "type" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "balanceMinor" BIGINT NOT NULL DEFAULT 0,
    "includeInNetWorth" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'active',
    "nickname" TEXT,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "creditLimitMinor" BIGINT,
    "statementDay" INTEGER,
    "dueDay" INTEGER,
    "minDueMinor" BIGINT,
    "investedMinor" BIGINT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Account" ("balanceMinor", "color", "createdAt", "creditLimitMinor", "currency", "description", "dueDay", "icon", "id", "includeInNetWorth", "institution", "investedMinor", "isDemo", "minDueMinor", "name", "nickname", "statementDay", "status", "type", "updatedAt", "userId") SELECT "balanceMinor", "color", "createdAt", "creditLimitMinor", "currency", "description", "dueDay", "icon", "id", "includeInNetWorth", "institution", "investedMinor", "isDemo", "minDueMinor", "name", "nickname", "statementDay", "status", "type", "updatedAt", "userId" FROM "Account";
DROP TABLE "Account";
ALTER TABLE "new_Account" RENAME TO "Account";
CREATE INDEX "Account_userId_idx" ON "Account"("userId");
CREATE TABLE "new_BalanceHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "previousMinor" BIGINT NOT NULL,
    "newMinor" BIGINT NOT NULL,
    "diffMinor" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "transactionId" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BalanceHistory_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BalanceHistory" ("accountId", "createdAt", "diffMinor", "id", "newMinor", "note", "previousMinor", "reason", "transactionId") SELECT "accountId", "createdAt", "diffMinor", "id", "newMinor", "note", "previousMinor", "reason", "transactionId" FROM "BalanceHistory";
DROP TABLE "BalanceHistory";
ALTER TABLE "new_BalanceHistory" RENAME TO "BalanceHistory";
CREATE INDEX "BalanceHistory_accountId_idx" ON "BalanceHistory"("accountId");
CREATE TABLE "new_Budget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT,
    "amountMinor" BIGINT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Budget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Budget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Budget" ("amountMinor", "categoryId", "createdAt", "id", "isDemo", "updatedAt", "userId") SELECT "amountMinor", "categoryId", "createdAt", "id", "isDemo", "updatedAt", "userId" FROM "Budget";
DROP TABLE "Budget";
ALTER TABLE "new_Budget" RENAME TO "Budget";
CREATE INDEX "Budget_userId_idx" ON "Budget"("userId");
CREATE UNIQUE INDEX "Budget_userId_categoryId_key" ON "Budget"("userId", "categoryId");
CREATE TABLE "new_NetWorthSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "totalAssetsMinor" BIGINT NOT NULL,
    "totalLiabilitiesMinor" BIGINT NOT NULL,
    "netWorthMinor" BIGINT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NetWorthSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_NetWorthSnapshot" ("createdAt", "date", "id", "isDemo", "netWorthMinor", "totalAssetsMinor", "totalLiabilitiesMinor", "userId") SELECT "createdAt", "date", "id", "isDemo", "netWorthMinor", "totalAssetsMinor", "totalLiabilitiesMinor", "userId" FROM "NetWorthSnapshot";
DROP TABLE "NetWorthSnapshot";
ALTER TABLE "new_NetWorthSnapshot" RENAME TO "NetWorthSnapshot";
CREATE INDEX "NetWorthSnapshot_userId_date_idx" ON "NetWorthSnapshot"("userId", "date");
CREATE TABLE "new_RecurringTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "toAccountId" TEXT,
    "categoryId" TEXT,
    "frequency" TEXT NOT NULL,
    "intervalDays" INTEGER,
    "nextDate" DATETIME NOT NULL,
    "lastRunDate" DATETIME,
    "notes" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RecurringTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecurringTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RecurringTransaction_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RecurringTransaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RecurringTransaction" ("accountId", "amountMinor", "categoryId", "createdAt", "frequency", "id", "intervalDays", "isDemo", "lastRunDate", "name", "nextDate", "notes", "toAccountId", "type", "updatedAt", "userId") SELECT "accountId", "amountMinor", "categoryId", "createdAt", "frequency", "id", "intervalDays", "isDemo", "lastRunDate", "name", "nextDate", "notes", "toAccountId", "type", "updatedAt", "userId" FROM "RecurringTransaction";
DROP TABLE "RecurringTransaction";
ALTER TABLE "new_RecurringTransaction" RENAME TO "RecurringTransaction";
CREATE INDEX "RecurringTransaction_userId_idx" ON "RecurringTransaction"("userId");
CREATE INDEX "RecurringTransaction_nextDate_idx" ON "RecurringTransaction"("nextDate");
CREATE TABLE "new_SavingsGoal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetMinor" BIGINT NOT NULL,
    "currentMinor" BIGINT NOT NULL DEFAULT 0,
    "targetDate" DATETIME,
    "linkedAccountId" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "notes" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SavingsGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SavingsGoal_linkedAccountId_fkey" FOREIGN KEY ("linkedAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SavingsGoal" ("createdAt", "currentMinor", "id", "isDemo", "linkedAccountId", "name", "notes", "priority", "targetDate", "targetMinor", "updatedAt", "userId") SELECT "createdAt", "currentMinor", "id", "isDemo", "linkedAccountId", "name", "notes", "priority", "targetDate", "targetMinor", "updatedAt", "userId" FROM "SavingsGoal";
DROP TABLE "SavingsGoal";
ALTER TABLE "new_SavingsGoal" RENAME TO "SavingsGoal";
CREATE INDEX "SavingsGoal_userId_idx" ON "SavingsGoal"("userId");
CREATE TABLE "new_Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT,
    "amountMinor" BIGINT NOT NULL,
    "frequency" TEXT NOT NULL,
    "intervalDays" INTEGER,
    "startDate" DATETIME NOT NULL,
    "nextBillingDate" DATETIME NOT NULL,
    "lastChargedDate" DATETIME,
    "accountId" TEXT,
    "categoryId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Subscription_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Subscription_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Subscription" ("accountId", "amountMinor", "autoRenew", "categoryId", "createdAt", "frequency", "id", "intervalDays", "isDemo", "lastChargedDate", "name", "nextBillingDate", "notes", "provider", "startDate", "status", "updatedAt", "userId") SELECT "accountId", "amountMinor", "autoRenew", "categoryId", "createdAt", "frequency", "id", "intervalDays", "isDemo", "lastChargedDate", "name", "nextBillingDate", "notes", "provider", "startDate", "status", "updatedAt", "userId" FROM "Subscription";
DROP TABLE "Subscription";
ALTER TABLE "new_Subscription" RENAME TO "Subscription";
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");
CREATE INDEX "Subscription_nextBillingDate_idx" ON "Subscription"("nextBillingDate");
CREATE TABLE "new_Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "date" DATETIME NOT NULL,
    "accountId" TEXT NOT NULL,
    "toAccountId" TEXT,
    "feeMinor" BIGINT,
    "categoryId" TEXT,
    "merchant" TEXT,
    "paymentMethod" TEXT,
    "tags" TEXT,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "subscriptionId" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("accountId", "amountMinor", "categoryId", "createdAt", "date", "description", "feeMinor", "id", "isDemo", "merchant", "name", "paymentMethod", "recurring", "subscriptionId", "tags", "toAccountId", "type", "updatedAt", "userId") SELECT "accountId", "amountMinor", "categoryId", "createdAt", "date", "description", "feeMinor", "id", "isDemo", "merchant", "name", "paymentMethod", "recurring", "subscriptionId", "tags", "toAccountId", "type", "updatedAt", "userId" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
CREATE INDEX "Transaction_userId_date_idx" ON "Transaction"("userId", "date");
CREATE INDEX "Transaction_accountId_idx" ON "Transaction"("accountId");
CREATE INDEX "Transaction_type_idx" ON "Transaction"("type");
CREATE INDEX "Transaction_categoryId_idx" ON "Transaction"("categoryId");
CREATE INDEX "Transaction_subscriptionId_idx" ON "Transaction"("subscriptionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

