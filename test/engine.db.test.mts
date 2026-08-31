// Integration tests over the REAL path: engine -> Prisma -> SQLite -> BalanceHistory.
// A throwaway SQLite database is created and schema-pushed per run, so these
// assert exactly what the server actions do (create/edit/delete a transaction),
// not an in-memory approximation. Run: npm test
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

import { applyTransaction, reverseTransactionHistory, type TxnCore } from "../lib/engine.ts";

let prisma: PrismaClient;
let dir: string;
let userId: string;

before(() => {
  dir = mkdtempSync(join(tmpdir(), "pfd-itest-"));
  const url = `file:${join(dir, "test.db")}`;
  // Build the schema in the temp DB using the local Prisma CLI (offline).
  execFileSync("node_modules/.bin/prisma", ["db", "push", "--skip-generate", "--accept-data-loss"], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
  prisma = new PrismaClient({ datasources: { db: { url } } });
});

after(async () => {
  await prisma.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

// --- helpers mirroring app/actions/transactions.ts --------------------------
async function acct(type: string, balanceMinor: number, name = type) {
  const a = await prisma.account.create({ data: { userId, name, type, balanceMinor } });
  await prisma.balanceHistory.create({
    data: { accountId: a.id, previousMinor: 0, newMinor: balanceMinor, diffMinor: balanceMinor, reason: "INITIAL" },
  });
  return a;
}

async function bal(id: string) {
  return (await prisma.account.findUniqueOrThrow({ where: { id } })).balanceMinor;
}

async function createTxn(core: TxnCore & { name?: string }) {
  return prisma.$transaction(async (tx) => {
    const from = await tx.account.findUniqueOrThrow({ where: { id: core.accountId } });
    const to = core.toAccountId ? await tx.account.findUniqueOrThrow({ where: { id: core.toAccountId } }) : null;
    const row = await tx.transaction.create({
      data: {
        userId,
        type: core.type,
        amountMinor: core.amountMinor,
        name: core.name ?? core.type,
        date: new Date(),
        accountId: core.accountId,
        toAccountId: core.toAccountId ?? null,
        feeMinor: core.feeMinor ?? null,
      },
    });
    await applyTransaction(tx, core, from.type, to?.type ?? null, row.id);
    return row.id;
  });
}

async function editTxn(id: string, core: TxnCore) {
  await prisma.$transaction(async (tx) => {
    const from = await tx.account.findUniqueOrThrow({ where: { id: core.accountId } });
    const to = core.toAccountId ? await tx.account.findUniqueOrThrow({ where: { id: core.toAccountId } }) : null;
    await reverseTransactionHistory(tx, id);
    await tx.transaction.update({
      where: { id },
      data: { amountMinor: core.amountMinor, accountId: core.accountId, toAccountId: core.toAccountId ?? null, feeMinor: core.feeMinor ?? null },
    });
    await applyTransaction(tx, core, from.type, to?.type ?? null, id);
  });
}

async function deleteTxn(id: string) {
  await prisma.$transaction(async (tx) => {
    await reverseTransactionHistory(tx, id);
    await tx.transaction.delete({ where: { id } });
  });
}

before(async () => {
  const u = await prisma.user.create({ data: { name: "Test" } });
  userId = u.id;
});

// --- Scenario A: create expense, delete, exact restore ----------------------
test("A: create ₹2,000 expense on a ₹10,000 bank, delete -> back to ₹10,000", async () => {
  const bank = await acct("Bank Account", 1000000, "A-bank");
  const id = await createTxn({ type: "EXPENSE", amountMinor: 200000, accountId: bank.id });
  assert.equal(await bal(bank.id), 800000);
  // BalanceHistory recorded the move
  const rows = await prisma.balanceHistory.findMany({ where: { transactionId: id } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].diffMinor, -200000);
  await deleteTxn(id);
  assert.equal(await bal(bank.id), 1000000);
  assert.equal((await prisma.balanceHistory.findMany({ where: { transactionId: id } })).length, 0);
});

// --- Scenario B: edit ₹2,000 -> ₹5,000 lands on ₹5,000 ----------------------
test("B: edit expense ₹2,000 -> ₹5,000 leaves balance at ₹5,000 (not 3,000 / 7,000)", async () => {
  const bank = await acct("Bank Account", 1000000, "B-bank");
  const id = await createTxn({ type: "EXPENSE", amountMinor: 200000, accountId: bank.id });
  assert.equal(await bal(bank.id), 800000);
  await editTxn(id, { type: "EXPENSE", amountMinor: 500000, accountId: bank.id });
  assert.equal(await bal(bank.id), 500000);
});

// --- Scenario C: credit-card payment ----------------------------------------
test("C: pay ₹5,000 card bill -> bank 45,000, card owed 5,000, net worth flat", async () => {
  const bank = await acct("Bank Account", 5000000, "C-bank");
  const card = await acct("Credit Card", 1000000, "C-card");
  const nwBefore = (await bal(bank.id)) - (await bal(card.id));
  await createTxn({ type: "CREDIT_CARD_PAYMENT", amountMinor: 500000, accountId: bank.id, toAccountId: card.id });
  assert.equal(await bal(bank.id), 4500000);
  assert.equal(await bal(card.id), 500000);
  assert.equal((await bal(bank.id)) - (await bal(card.id)), nwBefore);
});

// --- Scenario D: transfer preserves net worth -------------------------------
test("D: transfer ₹10,000 A -> B leaves combined net worth identical", async () => {
  const a = await acct("Bank Account", 3000000, "D-a");
  const b = await acct("Bank Account", 0, "D-b");
  const before = (await bal(a.id)) + (await bal(b.id));
  await createTxn({ type: "TRANSFER", amountMinor: 1000000, accountId: a.id, toAccountId: b.id });
  assert.equal(await bal(a.id), 2000000);
  assert.equal(await bal(b.id), 1000000);
  assert.equal((await bal(a.id)) + (await bal(b.id)), before);
});

// --- Atomicity: a failing transfer rolls everything back --------------------
test("atomicity: a transfer that throws mid-way leaves NO partial balance change", async () => {
  const a = await acct("Bank Account", 1000000, "R-a");
  const before = await bal(a.id);
  await assert.rejects(
    prisma.$transaction(async (tx) => {
      await applyTransaction(tx, { type: "EXPENSE", amountMinor: 100000, accountId: a.id }, "Bank Account", null, "no-such-txn-id");
      throw new Error("boom"); // simulate a later step failing
    }),
    /boom/,
  );
  assert.equal(await bal(a.id), before); // rolled back
  assert.equal((await prisma.balanceHistory.findMany({ where: { transactionId: "no-such-txn-id" } })).length, 0);
});
