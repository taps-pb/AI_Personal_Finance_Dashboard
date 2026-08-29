"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, OptionSelect } from "@/components/forms/form-kit";
import { updateBalance } from "@/app/actions/accounts";
import type { AcctOpt } from "@/components/forms/txn-forms";

export function UpdateBalanceInlineForm({ accounts, onDone }: { accounts: AcctOpt[]; onDone: () => void }) {
  const router = useRouter();
  const [accountId, setAccountId] = React.useState(accounts[0]?.id ?? "");
  const [newBalance, setNewBalance] = React.useState("");
  const [note, setNote] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string>();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setPending(true);
    const res = await updateBalance({ accountId, newBalance, note });
    setPending(false);
    if (res.ok) {
      router.refresh();
      onDone();
    } else setError(res.error);
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <Field label="Account">
        <OptionSelect value={accountId} onChange={setAccountId} options={accounts} placeholder="Account" />
      </Field>
      <Field label="New balance (₹)" hint="The change is recorded in the account’s balance history.">
        <Input value={newBalance} onChange={(e) => setNewBalance(e.target.value)} inputMode="decimal" placeholder="0" autoFocus />
      </Field>
      <Field label="Note">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
      </Field>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending} className="mt-1">
        {pending ? "Saving…" : "Update balance"}
      </Button>
    </form>
  );
}
