// Form validation at the trust boundary (spec §50). Rupee strings -> integer paise.
import { z } from "zod";
// Relative (not "@/") imports so validation is runnable under `node --test`.
import { rupeesToPaise } from "./money.ts";
import { ACCOUNT_TYPES, BILLING_FREQUENCIES } from "./constants.ts";

const toPaise = z
  .string()
  .trim()
  .min(1, "Required")
  .transform((v, ctx) => {
    try {
      return rupeesToPaise(v);
    } catch {
      ctx.addIssue({ code: "custom", message: "Enter a valid amount" });
      return z.NEVER;
    }
  });

const positiveMoney = toPaise.refine((v) => v > 0, "Amount must be greater than zero");
const optionalStr = z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().trim().optional());
const optionalMoney = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.string().optional(),
).transform((v, ctx) => {
  if (v == null) return undefined;
  try {
    return rupeesToPaise(v);
  } catch {
    ctx.addIssue({ code: "custom", message: "Enter a valid amount" });
    return z.NEVER;
  }
});
const dateStr = z.string().min(1, "Date is required");

export const accountSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  type: z.string().refine((v) => (ACCOUNT_TYPES as readonly string[]).includes(v), "Invalid account type"),
  institution: optionalStr,
  balance: toPaise, // may be 0 or negative for adjustments
  includeInNetWorth: z.boolean().default(true),
  nickname: optionalStr,
  description: optionalStr,
  icon: optionalStr,
  color: optionalStr,
  creditLimit: optionalMoney.refine((v) => v === undefined || v >= 0, "Credit limit cannot be negative"),
  statementDay: z.coerce.number().int().min(1).max(31).optional(),
  dueDay: z.coerce.number().int().min(1).max(31).optional(),
  investedAmount: optionalMoney,
});

export const expenseSchema = z.object({
  amount: positiveMoney,
  name: z.string().trim().min(1, "Name is required"),
  accountId: z.string().min(1, "Account is required"),
  categoryId: optionalStr,
  date: dateStr,
  merchant: optionalStr,
  paymentMethod: optionalStr,
  description: optionalStr,
  tags: optionalStr,
});

export const incomeSchema = z.object({
  amount: positiveMoney,
  name: z.string().trim().min(1, "Source is required"),
  accountId: z.string().min(1, "Account is required"),
  categoryId: optionalStr,
  date: dateStr,
  description: optionalStr,
  tags: optionalStr,
});

export const transferSchema = z
  .object({
    fromAccountId: z.string().min(1, "From account is required"),
    toAccountId: z.string().min(1, "To account is required"),
    amount: positiveMoney,
    fee: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? rupeesToPaise(v) : 0)),
    date: dateStr,
    note: optionalStr,
  })
  .refine((v) => v.fromAccountId !== v.toAccountId, {
    message: "From and to accounts cannot be the same",
    path: ["toAccountId"],
  });

export const ccPaymentSchema = z
  .object({
    fromAccountId: z.string().min(1, "Paying account is required"),
    toAccountId: z.string().min(1, "Credit card is required"),
    amount: positiveMoney,
    date: dateStr,
    note: optionalStr,
  })
  .refine((v) => v.fromAccountId !== v.toAccountId, {
    message: "Accounts cannot be the same",
    path: ["toAccountId"],
  });

export const updateBalanceSchema = z.object({
  accountId: z.string().min(1),
  newBalance: toPaise,
  note: optionalStr,
});

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  kind: z.enum(["expense", "income"]),
  parentId: optionalStr,
  icon: optionalStr,
  color: optionalStr,
});

export const subscriptionSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  provider: optionalStr,
  amount: positiveMoney,
  frequency: z.enum(BILLING_FREQUENCIES),
  intervalDays: z.coerce.number().int().min(1).max(3650).optional(),
  startDate: dateStr,
  nextBillingDate: optionalStr,
  accountId: optionalStr,
  categoryId: optionalStr,
  autoRenew: z.boolean().default(true),
  notes: optionalStr,
});

export const recurringSchema = z.object({
  type: z.enum(["EXPENSE", "INCOME", "TRANSFER"]),
  amount: positiveMoney,
  name: z.string().trim().min(1, "Name is required"),
  accountId: z.string().min(1, "Account is required"),
  toAccountId: optionalStr,
  categoryId: optionalStr,
  frequency: z.enum(BILLING_FREQUENCIES),
  intervalDays: z.coerce.number().int().min(1).max(3650).optional(),
  nextDate: dateStr,
  notes: optionalStr,
});

export const budgetSchema = z.object({
  categoryId: optionalStr, // empty => overall budget
  amount: positiveMoney,
});

export const goalSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  target: positiveMoney,
  current: optionalMoney,
  targetDate: optionalStr,
  linkedAccountId: optionalStr,
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  notes: optionalStr,
});

export const contributeSchema = z.object({
  amount: toPaise.refine((v) => v !== 0, "Enter a non-zero amount"),
});

export type ActionResult = { ok: true } | { ok: false; error: string };
