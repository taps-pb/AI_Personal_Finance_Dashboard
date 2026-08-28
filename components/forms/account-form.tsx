"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, OptionSelect } from "@/components/forms/form-kit";
import { ACCOUNT_TYPES, LIABILITY_ACCOUNT_TYPES, INVESTMENT_ACCOUNT_TYPES } from "@/lib/constants";
import { createAccount, updateAccount } from "@/app/actions/accounts";
import { paiseToRupees } from "@/lib/money";

const COLORS = ["#6366f1", "#f97316", "#3b82f6", "#22c55e", "#ef4444", "#a855f7", "#eab308", "#14b8a6"];

export interface AccountInitial {
  id: string;
  name: string;
  type: string;
  institution?: string | null;
  balanceMinor: number;
  includeInNetWorth: boolean;
  icon?: string | null;
  color?: string | null;
  creditLimitMinor?: number | null;
  statementDay?: number | null;
  dueDay?: number | null;
  investedMinor?: number | null;
}

export function AccountForm({ initial, onDone }: { initial?: AccountInitial; onDone: () => void }) {
  const router = useRouter();
  const editing = !!initial;
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string>();

  const [name, setName] = React.useState(initial?.name ?? "");
  const [type, setType] = React.useState(initial?.type ?? "Savings Account");
  const [institution, setInstitution] = React.useState(initial?.institution ?? "");
  const [balance, setBalance] = React.useState(initial ? String(paiseToRupees(initial.balanceMinor)) : "");
  const [includeInNetWorth, setInclude] = React.useState(initial?.includeInNetWorth ?? true);
  const [icon, setIcon] = React.useState(initial?.icon ?? "");
  const [color, setColor] = React.useState(initial?.color ?? COLORS[0]);
  const [creditLimit, setCreditLimit] = React.useState(
    initial?.creditLimitMinor != null ? String(paiseToRupees(initial.creditLimitMinor)) : "",
  );
  const [statementDay, setStatementDay] = React.useState(initial?.statementDay ? String(initial.statementDay) : "");
  const [dueDay, setDueDay] = React.useState(initial?.dueDay ? String(initial.dueDay) : "");
  const [invested, setInvested] = React.useState(
    initial?.investedMinor != null ? String(paiseToRupees(initial.investedMinor)) : "",
  );

  const isLiability = LIABILITY_ACCOUNT_TYPES.includes(type);
  const isCard = type === "Credit Card";
  const isInvestment = INVESTMENT_ACCOUNT_TYPES.includes(type);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setPending(true);
    const payload = {
      name,
      type,
      institution,
      balance: balance === "" ? "0" : balance,
      includeInNetWorth,
      icon,
      color,
      creditLimit: isCard ? creditLimit : "",
      statementDay: isCard && statementDay ? statementDay : undefined,
      dueDay: isCard && dueDay ? dueDay : undefined,
      investedAmount: isInvestment ? invested : "",
    };
    const res = editing ? await updateAccount(initial.id, payload) : await createAccount(payload);
    setPending(false);
    if (res.ok) {
      router.refresh();
      onDone();
    } else {
      setError(res.error);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <Field label="Account name">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. ICICI Savings" autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <OptionSelect value={type} onChange={setType} placeholder="Type" options={ACCOUNT_TYPES.map((t) => ({ id: t, name: t }))} />
        </Field>
        <Field label="Institution">
          <Input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="Optional" />
        </Field>
      </div>

      {!editing && (
        <Field label={isLiability ? "Current outstanding (₹)" : "Current balance (₹)"} hint={isLiability ? "How much you owe on this account" : undefined}>
          <Input value={balance} onChange={(e) => setBalance(e.target.value)} inputMode="decimal" placeholder="0" />
        </Field>
      )}
      {editing && (
        <p className="text-xs text-muted-foreground">
          To change the balance, use “Update balance” so the change is recorded in history.
        </p>
      )}

      {isCard && (
        <div className="grid grid-cols-3 gap-3">
          <Field label="Credit limit (₹)">
            <Input value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} inputMode="decimal" placeholder="0" />
          </Field>
          <Field label="Statement day">
            <Input value={statementDay} onChange={(e) => setStatementDay(e.target.value)} inputMode="numeric" placeholder="5" />
          </Field>
          <Field label="Due day">
            <Input value={dueDay} onChange={(e) => setDueDay(e.target.value)} inputMode="numeric" placeholder="22" />
          </Field>
        </div>
      )}

      {isInvestment && (
        <Field label="Invested amount (₹)" hint="Used to show profit / loss">
          <Input value={invested} onChange={(e) => setInvested(e.target.value)} inputMode="decimal" placeholder="Optional" />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Icon (emoji)">
          <Input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="🏦" maxLength={2} />
        </Field>
        <Field label="Color">
          <div className="flex flex-wrap gap-2 pt-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
                className={`size-6 rounded-full border-2 ${color === c ? "border-foreground" : "border-transparent"}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={includeInNetWorth} onChange={(e) => setInclude(e.target.checked)} className="size-4 accent-[var(--primary)]" />
        Include in net worth
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : editing ? "Save changes" : "Add account"}
        </Button>
      </div>
    </form>
  );
}
