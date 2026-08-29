"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, OptionSelect, todayInput, type Opt } from "@/components/forms/form-kit";
import { paiseToRupees } from "@/lib/money";
import {
  createExpense,
  editExpense,
  createIncome,
  editIncome,
  createTransfer,
  editTransfer,
  createCcPayment,
  editCcPayment,
} from "@/app/actions/transactions";
import type { ActionResult } from "@/lib/validation";

export interface AcctOpt {
  id: string;
  name: string;
  type: string;
  icon?: string | null;
}
export interface CatOpt {
  id: string;
  name: string;
  kind: string;
  parentId?: string | null;
}

/** Fields needed to prefill an edit form (paise + ISO date). */
export interface TxnInitial {
  id: string;
  amountMinor: number;
  accountId: string;
  toAccountId?: string | null;
  categoryId?: string | null;
  feeMinor?: number | null;
  name: string;
  dateISO: string;
  merchant?: string | null;
  paymentMethod?: string | null;
  description?: string | null;
}

export function catOptions(categories: CatOpt[], kind: string): Opt[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  return categories
    .filter((c) => c.kind === kind)
    .map((c) => ({ id: c.id, name: c.parentId ? `${byId.get(c.parentId)?.name ?? ""} / ${c.name}` : c.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function useSubmit() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string>();
  async function run(fn: () => Promise<ActionResult>, onDone: () => void) {
    setError(undefined);
    setPending(true);
    const res = await fn();
    setPending(false);
    if (res.ok) {
      router.refresh();
      onDone();
    } else setError(res.error);
  }
  return { pending, error, run };
}

function Submit({ pending, label }: { pending: boolean; label: string }) {
  return (
    <Button type="submit" disabled={pending} className="mt-1">
      {pending ? "Saving…" : label}
    </Button>
  );
}

function Err({ msg }: { msg?: string }) {
  return msg ? <p className="text-sm text-destructive">{msg}</p> : null;
}

const rupees = (minor?: number | null) => (minor != null ? String(paiseToRupees(minor)) : "");
const dateOf = (iso?: string) => (iso ? iso.slice(0, 10) : todayInput());

export function ExpenseForm({
  accounts,
  categories,
  initial,
  onDone,
}: {
  accounts: AcctOpt[];
  categories: CatOpt[];
  initial?: TxnInitial;
  onDone: () => void;
}) {
  const { pending, error, run } = useSubmit();
  const [amount, setAmount] = React.useState(rupees(initial?.amountMinor));
  const [accountId, setAccountId] = React.useState(initial?.accountId ?? accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = React.useState(initial?.categoryId ?? "");
  const [name, setName] = React.useState(initial?.name ?? "");
  const [date, setDate] = React.useState(dateOf(initial?.dateISO));
  const [more, setMore] = React.useState(!!(initial?.merchant || initial?.paymentMethod || initial?.description));
  const [merchant, setMerchant] = React.useState(initial?.merchant ?? "");
  const [paymentMethod, setPaymentMethod] = React.useState(initial?.paymentMethod ?? "");
  const [description, setDescription] = React.useState(initial?.description ?? "");

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const payload = { amount, accountId, categoryId, name, date, merchant, paymentMethod, description };
        run(() => (initial ? editExpense(initial.id, payload) : createExpense(payload)), onDone);
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount (₹)">
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0" autoFocus />
        </Field>
        <Field label="Account">
          <OptionSelect value={accountId} onChange={setAccountId} options={accounts} placeholder="Account" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <OptionSelect value={categoryId} onChange={setCategoryId} options={catOptions(categories, "expense")} placeholder="Category" />
        </Field>
        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <Field label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dinner" />
      </Field>
      {!more && (
        <button type="button" className="justify-self-start text-xs text-primary hover:underline" onClick={() => setMore(true)}>
          More options
        </button>
      )}
      {more && (
        <div className="grid gap-3 rounded-md border border-border p-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Merchant">
              <Input value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="e.g. Zomato" />
            </Field>
            <Field label="Payment method">
              <Input value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} placeholder="UPI / Card" />
            </Field>
          </div>
          <Field label="Notes">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
          </Field>
        </div>
      )}
      <Err msg={error} />
      <Submit pending={pending} label={initial ? "Save changes" : "Add expense"} />
    </form>
  );
}

export function IncomeForm({
  accounts,
  categories,
  initial,
  onDone,
}: {
  accounts: AcctOpt[];
  categories: CatOpt[];
  initial?: TxnInitial;
  onDone: () => void;
}) {
  const { pending, error, run } = useSubmit();
  const [amount, setAmount] = React.useState(rupees(initial?.amountMinor));
  const [accountId, setAccountId] = React.useState(initial?.accountId ?? accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = React.useState(initial?.categoryId ?? "");
  const [name, setName] = React.useState(initial?.name ?? "");
  const [date, setDate] = React.useState(dateOf(initial?.dateISO));

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const payload = { amount, accountId, categoryId, name, date };
        run(() => (initial ? editIncome(initial.id, payload) : createIncome(payload)), onDone);
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount (₹)">
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0" autoFocus />
        </Field>
        <Field label="Into account">
          <OptionSelect value={accountId} onChange={setAccountId} options={accounts} placeholder="Account" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Source">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Salary" />
        </Field>
        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <Field label="Category">
        <OptionSelect value={categoryId} onChange={setCategoryId} options={catOptions(categories, "income")} placeholder="Category" />
      </Field>
      <Err msg={error} />
      <Submit pending={pending} label={initial ? "Save changes" : "Add income"} />
    </form>
  );
}

export function TransferForm({ accounts, initial, onDone }: { accounts: AcctOpt[]; initial?: TxnInitial; onDone: () => void }) {
  const { pending, error, run } = useSubmit();
  const [fromAccountId, setFrom] = React.useState(initial?.accountId ?? accounts[0]?.id ?? "");
  const [toAccountId, setTo] = React.useState(initial?.toAccountId ?? accounts[1]?.id ?? "");
  const [amount, setAmount] = React.useState(rupees(initial?.amountMinor));
  const [fee, setFee] = React.useState(rupees(initial?.feeMinor));
  const [date, setDate] = React.useState(dateOf(initial?.dateISO));
  const [note, setNote] = React.useState(initial?.description ?? "");

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const payload = { fromAccountId, toAccountId, amount, fee, date, note };
        run(() => (initial ? editTransfer(initial.id, payload) : createTransfer(payload)), onDone);
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="From">
          <OptionSelect value={fromAccountId} onChange={setFrom} options={accounts} placeholder="From" />
        </Field>
        <Field label="To">
          <OptionSelect value={toAccountId} onChange={setTo} options={accounts} placeholder="To" />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Amount (₹)">
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0" autoFocus />
        </Field>
        <Field label="Fee (₹)" hint="Optional">
          <Input value={fee} onChange={(e) => setFee(e.target.value)} inputMode="decimal" placeholder="0" />
        </Field>
        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <Field label="Note">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
      </Field>
      <p className="text-xs text-muted-foreground">Transfers move money between your accounts — not counted as income or spending. Only a fee counts as spending.</p>
      <Err msg={error} />
      <Submit pending={pending} label={initial ? "Save changes" : "Transfer"} />
    </form>
  );
}

export function CcPaymentForm({ accounts, initial, onDone }: { accounts: AcctOpt[]; initial?: TxnInitial; onDone: () => void }) {
  const { pending, error, run } = useSubmit();
  const cards = accounts.filter((a) => a.type === "Credit Card");
  const banks = accounts.filter((a) => a.type !== "Credit Card");
  const [fromAccountId, setFrom] = React.useState(initial?.accountId ?? banks[0]?.id ?? "");
  const [toAccountId, setTo] = React.useState(initial?.toAccountId ?? cards[0]?.id ?? "");
  const [amount, setAmount] = React.useState(rupees(initial?.amountMinor));
  const [date, setDate] = React.useState(dateOf(initial?.dateISO));
  const [note, setNote] = React.useState(initial?.description ?? "");

  if (cards.length === 0) {
    return <p className="text-sm text-muted-foreground">Add a credit-card account first to record a payment.</p>;
  }

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const payload = { fromAccountId, toAccountId, amount, date, note };
        run(() => (initial ? editCcPayment(initial.id, payload) : createCcPayment(payload)), onDone);
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Pay from">
          <OptionSelect value={fromAccountId} onChange={setFrom} options={banks} placeholder="Bank account" />
        </Field>
        <Field label="Credit card">
          <OptionSelect value={toAccountId} onChange={setTo} options={cards} placeholder="Card" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount (₹)">
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0" autoFocus />
        </Field>
        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <Field label="Note">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
      </Field>
      <p className="text-xs text-muted-foreground">Reduces your bank balance and the card’s outstanding equally. Not counted as new spending.</p>
      <Err msg={error} />
      <Submit pending={pending} label={initial ? "Save changes" : "Record payment"} />
    </form>
  );
}
