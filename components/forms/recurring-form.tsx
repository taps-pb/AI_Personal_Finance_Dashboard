"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, OptionSelect, todayInput } from "@/components/forms/form-kit";
import { paiseToRupees } from "@/lib/money";
import { BILLING_FREQUENCIES, FREQUENCY_LABELS } from "@/lib/constants";
import { createRecurring, updateRecurring } from "@/app/actions/recurring";
import type { AcctOpt, CatOpt } from "@/components/forms/txn-forms";
import { catOptions } from "@/components/forms/txn-forms";

export interface RecurInitial {
  id: string;
  type: string;
  amountMinor: number;
  name: string;
  accountId: string;
  toAccountId?: string | null;
  categoryId?: string | null;
  frequency: string;
  intervalDays?: number | null;
  nextISO: string;
  notes?: string | null;
}

const rupees = (m?: number | null) => (m != null ? String(paiseToRupees(m)) : "");
const dateOf = (iso?: string) => (iso ? iso.slice(0, 10) : todayInput());
const NONE = "__none__";

const TYPE_OPTS = [
  { id: "EXPENSE", name: "Expense" },
  { id: "INCOME", name: "Income" },
  { id: "TRANSFER", name: "Transfer" },
];

export function RecurringForm({
  accounts,
  categories,
  initial,
  onDone,
}: {
  accounts: AcctOpt[];
  categories: CatOpt[];
  initial?: RecurInitial;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string>();

  const [type, setType] = React.useState(initial?.type ?? "EXPENSE");
  const [amount, setAmount] = React.useState(rupees(initial?.amountMinor));
  const [name, setName] = React.useState(initial?.name ?? "");
  const [accountId, setAccountId] = React.useState(initial?.accountId ?? accounts[0]?.id ?? "");
  const [toAccountId, setToAccountId] = React.useState(initial?.toAccountId ?? accounts[1]?.id ?? "");
  const [categoryId, setCategoryId] = React.useState(initial?.categoryId ?? NONE);
  const [frequency, setFrequency] = React.useState(initial?.frequency ?? "monthly");
  const [intervalDays, setIntervalDays] = React.useState(initial?.intervalDays ? String(initial.intervalDays) : "");
  const [nextDate, setNextDate] = React.useState(dateOf(initial?.nextISO));
  const [notes, setNotes] = React.useState(initial?.notes ?? "");

  const isTransfer = type === "TRANSFER";
  const catKind = type === "INCOME" ? "income" : "expense";
  const catOpts = [{ id: NONE, name: "No category" }, ...catOptions(categories, catKind)];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setPending(true);
    const payload = {
      type,
      amount,
      name,
      accountId,
      toAccountId: isTransfer ? toAccountId : "",
      categoryId: isTransfer || categoryId === NONE ? "" : categoryId,
      frequency,
      intervalDays: frequency === "custom" && intervalDays ? intervalDays : undefined,
      nextDate,
      notes,
    };
    const res = initial ? await updateRecurring(initial.id, payload) : await createRecurring(payload);
    setPending(false);
    if (res.ok) {
      router.refresh();
      onDone();
    } else setError(res.error);
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <OptionSelect value={type} onChange={setType} options={TYPE_OPTS} placeholder="Type" />
        </Field>
        <Field label="Amount (₹)">
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0" />
        </Field>
      </div>
      <Field label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rent, Salary, SIP" autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={isTransfer ? "From" : "Account"}>
          <OptionSelect value={accountId} onChange={setAccountId} options={accounts} placeholder="Account" />
        </Field>
        {isTransfer ? (
          <Field label="To">
            <OptionSelect value={toAccountId} onChange={setToAccountId} options={accounts} placeholder="To" />
          </Field>
        ) : (
          <Field label="Category">
            <OptionSelect value={categoryId} onChange={setCategoryId} options={catOpts} placeholder="Category" />
          </Field>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Frequency">
          <OptionSelect value={frequency} onChange={setFrequency} placeholder="Frequency" options={BILLING_FREQUENCIES.map((f) => ({ id: f, name: FREQUENCY_LABELS[f] }))} />
        </Field>
        <Field label="Next date">
          <Input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
        </Field>
      </div>
      {frequency === "custom" && (
        <Field label="Interval (days)">
          <Input value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} inputMode="numeric" placeholder="30" />
        </Field>
      )}
      <Field label="Notes">
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
      </Field>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : initial ? "Save changes" : "Add recurring"}
        </Button>
      </div>
    </form>
  );
}
