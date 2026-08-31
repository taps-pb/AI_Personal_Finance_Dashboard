"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, OptionSelect } from "@/components/forms/form-kit";
import { paiseToRupees } from "@/lib/money";
import { createGoal, updateGoal } from "@/app/actions/goals";
import type { AcctOpt } from "@/components/forms/txn-forms";

export interface GoalInitial {
  id: string;
  name: string;
  targetMinor: number;
  targetISO?: string | null;
  linkedAccountId?: string | null;
  priority: string;
  notes?: string | null;
}

const NONE = "__none__";
const PRIORITIES = [
  { id: "high", name: "High" },
  { id: "medium", name: "Medium" },
  { id: "low", name: "Low" },
];

export function GoalForm({ accounts, initial, onDone }: { accounts: AcctOpt[]; initial?: GoalInitial; onDone: () => void }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string>();

  const [name, setName] = React.useState(initial?.name ?? "");
  const [target, setTarget] = React.useState(initial ? String(paiseToRupees(initial.targetMinor)) : "");
  const [current, setCurrent] = React.useState("");
  const [targetDate, setTargetDate] = React.useState(initial?.targetISO ? initial.targetISO.slice(0, 10) : "");
  const [linkedAccountId, setLinked] = React.useState(initial?.linkedAccountId ?? NONE);
  const [priority, setPriority] = React.useState(initial?.priority ?? "medium");
  const [notes, setNotes] = React.useState(initial?.notes ?? "");

  const acctOpts = [{ id: NONE, name: "No linked account" }, ...accounts.map((a) => ({ id: a.id, name: a.name }))];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setPending(true);
    const payload = {
      name,
      target,
      current: initial ? undefined : current,
      targetDate,
      linkedAccountId: linkedAccountId === NONE ? "" : linkedAccountId,
      priority,
      notes,
    };
    const res = initial ? await updateGoal(initial.id, payload) : await createGoal(payload);
    setPending(false);
    if (res.ok) {
      router.refresh();
      onDone();
    } else setError(res.error);
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <Field label="Goal name">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Emergency fund" autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Target amount (₹)">
          <Input value={target} onChange={(e) => setTarget(e.target.value)} inputMode="decimal" placeholder="0" />
        </Field>
        {!initial && (
          <Field label="Already saved (₹)">
            <Input value={current} onChange={(e) => setCurrent(e.target.value)} inputMode="decimal" placeholder="0" />
          </Field>
        )}
        {initial && (
          <Field label="Priority">
            <OptionSelect value={priority} onChange={setPriority} options={PRIORITIES} placeholder="Priority" />
          </Field>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Target date">
          <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
        </Field>
        {!initial ? (
          <Field label="Priority">
            <OptionSelect value={priority} onChange={setPriority} options={PRIORITIES} placeholder="Priority" />
          </Field>
        ) : (
          <Field label="Linked account">
            <OptionSelect value={linkedAccountId} onChange={setLinked} options={acctOpts} placeholder="Account" />
          </Field>
        )}
      </div>
      {!initial && (
        <Field label="Linked account">
          <OptionSelect value={linkedAccountId} onChange={setLinked} options={acctOpts} placeholder="Account" />
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
          {pending ? "Saving…" : initial ? "Save changes" : "Add goal"}
        </Button>
      </div>
    </form>
  );
}
