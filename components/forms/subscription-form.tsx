"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, OptionSelect, todayInput } from "@/components/forms/form-kit";
import { paiseToRupees } from "@/lib/money";
import { BILLING_FREQUENCIES, FREQUENCY_LABELS } from "@/lib/constants";
import { createSubscription, updateSubscription } from "@/app/actions/subscriptions";
import type { AcctOpt, CatOpt } from "@/components/forms/txn-forms";
import { catOptions } from "@/components/forms/txn-forms";

export interface SubInitial {
  id: string;
  name: string;
  provider?: string | null;
  amountMinor: number;
  frequency: string;
  intervalDays?: number | null;
  startISO: string;
  nextBillingISO: string;
  accountId?: string | null;
  categoryId?: string | null;
  autoRenew: boolean;
  notes?: string | null;
}

const rupees = (m?: number | null) => (m != null ? String(paiseToRupees(m)) : "");
const dateOf = (iso?: string) => (iso ? iso.slice(0, 10) : todayInput());
const NONE = "__none__";

export function SubscriptionForm({
  accounts,
  categories,
  initial,
  onDone,
}: {
  accounts: AcctOpt[];
  categories: CatOpt[];
  initial?: SubInitial;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string>();

  const [name, setName] = React.useState(initial?.name ?? "");
  const [provider, setProvider] = React.useState(initial?.provider ?? "");
  const [amount, setAmount] = React.useState(rupees(initial?.amountMinor));
  const [frequency, setFrequency] = React.useState(initial?.frequency ?? "monthly");
  const [intervalDays, setIntervalDays] = React.useState(initial?.intervalDays ? String(initial.intervalDays) : "");
  const [startDate, setStartDate] = React.useState(dateOf(initial?.startISO));
  const [nextBillingDate, setNext] = React.useState(dateOf(initial?.nextBillingISO));
  const [accountId, setAccountId] = React.useState(initial?.accountId ?? NONE);
  const [categoryId, setCategoryId] = React.useState(initial?.categoryId ?? NONE);
  const [autoRenew, setAutoRenew] = React.useState(initial?.autoRenew ?? true);
  const [notes, setNotes] = React.useState(initial?.notes ?? "");

  const acctOpts = [{ id: NONE, name: "No account" }, ...accounts.map((a) => ({ id: a.id, name: a.name }))];
  const catOpts = [{ id: NONE, name: "No category" }, ...catOptions(categories, "expense")];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setPending(true);
    const payload = {
      name,
      provider,
      amount,
      frequency,
      intervalDays: frequency === "custom" && intervalDays ? intervalDays : undefined,
      startDate,
      nextBillingDate,
      accountId: accountId === NONE ? "" : accountId,
      categoryId: categoryId === NONE ? "" : categoryId,
      autoRenew,
      notes,
    };
    const res = initial ? await updateSubscription(initial.id, payload) : await createSubscription(payload);
    setPending(false);
    if (res.ok) {
      router.refresh();
      onDone();
    } else setError(res.error);
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Netflix" autoFocus />
        </Field>
        <Field label="Provider">
          <Input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="Optional" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount (₹)">
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0" />
        </Field>
        <Field label="Billing frequency">
          <OptionSelect value={frequency} onChange={setFrequency} placeholder="Frequency" options={BILLING_FREQUENCIES.map((f) => ({ id: f, name: FREQUENCY_LABELS[f] }))} />
        </Field>
      </div>
      {frequency === "custom" && (
        <Field label="Interval (days)">
          <Input value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} inputMode="numeric" placeholder="30" />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start date">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label="Next billing date">
          <Input type="date" value={nextBillingDate} onChange={(e) => setNext(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Charged to">
          <OptionSelect value={accountId} onChange={setAccountId} options={acctOpts} placeholder="Account" />
        </Field>
        <Field label="Category">
          <OptionSelect value={categoryId} onChange={setCategoryId} options={catOpts} placeholder="Category" />
        </Field>
      </div>
      <Field label="Notes">
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} className="size-4 accent-[var(--primary)]" />
        Auto-renew
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : initial ? "Save changes" : "Add subscription"}
        </Button>
      </div>
    </form>
  );
}
