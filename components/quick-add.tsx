"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Receipt, Wallet, ArrowLeftRight, CreditCard, PencilLine, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Field, OptionSelect, todayInput, type Opt } from "@/components/forms/form-kit";
import { AccountForm } from "@/components/forms/account-form";
import {
  createExpense,
  createIncome,
  createTransfer,
  createCcPayment,
} from "@/app/actions/transactions";
import { updateBalance } from "@/app/actions/accounts";
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

type Which = null | "expense" | "income" | "transfer" | "cc" | "balance" | "account";

function catOptions(categories: CatOpt[], kind: string): Opt[] {
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
    } else {
      setError(res.error);
    }
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

// --- forms -------------------------------------------------------------------
function ExpenseForm({ accounts, categories, onDone }: { accounts: AcctOpt[]; categories: CatOpt[]; onDone: () => void }) {
  const { pending, error, run } = useSubmit();
  const [amount, setAmount] = React.useState("");
  const [accountId, setAccountId] = React.useState(accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = React.useState("");
  const [name, setName] = React.useState("");
  const [date, setDate] = React.useState(todayInput());
  const [more, setMore] = React.useState(false);
  const [merchant, setMerchant] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState("");
  const [description, setDescription] = React.useState("");

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => createExpense({ amount, accountId, categoryId, name, date, merchant, paymentMethod, description }), onDone);
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
      <Submit pending={pending} label="Add expense" />
    </form>
  );
}

function IncomeForm({ accounts, categories, onDone }: { accounts: AcctOpt[]; categories: CatOpt[]; onDone: () => void }) {
  const { pending, error, run } = useSubmit();
  const [amount, setAmount] = React.useState("");
  const [accountId, setAccountId] = React.useState(accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = React.useState("");
  const [name, setName] = React.useState("");
  const [date, setDate] = React.useState(todayInput());

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => createIncome({ amount, accountId, categoryId, name, date }), onDone);
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
      <Submit pending={pending} label="Add income" />
    </form>
  );
}

function TransferForm({ accounts, onDone }: { accounts: AcctOpt[]; onDone: () => void }) {
  const { pending, error, run } = useSubmit();
  const [fromAccountId, setFrom] = React.useState(accounts[0]?.id ?? "");
  const [toAccountId, setTo] = React.useState(accounts[1]?.id ?? "");
  const [amount, setAmount] = React.useState("");
  const [fee, setFee] = React.useState("");
  const [date, setDate] = React.useState(todayInput());
  const [note, setNote] = React.useState("");

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => createTransfer({ fromAccountId, toAccountId, amount, fee, date, note }), onDone);
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
      <Submit pending={pending} label="Transfer" />
    </form>
  );
}

function CcPaymentForm({ accounts, onDone }: { accounts: AcctOpt[]; onDone: () => void }) {
  const { pending, error, run } = useSubmit();
  const cards = accounts.filter((a) => a.type === "Credit Card");
  const banks = accounts.filter((a) => a.type !== "Credit Card");
  const [fromAccountId, setFrom] = React.useState(banks[0]?.id ?? "");
  const [toAccountId, setTo] = React.useState(cards[0]?.id ?? "");
  const [amount, setAmount] = React.useState("");
  const [date, setDate] = React.useState(todayInput());
  const [note, setNote] = React.useState("");

  if (cards.length === 0) {
    return <p className="text-sm text-muted-foreground">Add a credit-card account first to record a payment.</p>;
  }

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => createCcPayment({ fromAccountId, toAccountId, amount, date, note }), onDone);
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
      <Submit pending={pending} label="Record payment" />
    </form>
  );
}

function UpdateBalanceForm({ accounts, onDone }: { accounts: AcctOpt[]; onDone: () => void }) {
  const { pending, error, run } = useSubmit();
  const [accountId, setAccountId] = React.useState(accounts[0]?.id ?? "");
  const [newBalance, setNewBalance] = React.useState("");
  const [note, setNote] = React.useState("");

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateBalance({ accountId, newBalance, note }), onDone);
      }}
    >
      <Field label="Account">
        <OptionSelect value={accountId} onChange={setAccountId} options={accounts} placeholder="Account" />
      </Field>
      <Field label="New balance (₹)" hint="The change is recorded in the account’s balance history.">
        <Input value={newBalance} onChange={(e) => setNewBalance(e.target.value)} inputMode="decimal" placeholder="0" autoFocus />
      </Field>
      <Field label="Note">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
      </Field>
      <Err msg={error} />
      <Submit pending={pending} label="Update balance" />
    </form>
  );
}

const TITLES: Record<Exclude<Which, null>, { title: string; desc: string }> = {
  expense: { title: "Add expense", desc: "Money you spent." },
  income: { title: "Add income", desc: "Money you received." },
  transfer: { title: "Transfer money", desc: "Move money between your accounts." },
  cc: { title: "Credit-card payment", desc: "Pay down a card from a bank account." },
  balance: { title: "Update balance", desc: "Set an account to its real balance." },
  account: { title: "Add account", desc: "A place where money is stored or owed." },
};

export function QuickAdd({ accounts, categories }: { accounts: AcctOpt[]; categories: CatOpt[] }) {
  const [which, setWhich] = React.useState<Which>(null);
  const close = () => setWhich(null);
  const noAccounts = accounts.length === 0;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm">
            <Plus /> Add
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Quick add</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setWhich("expense")} className={noAccounts ? "pointer-events-none opacity-50" : ""}>
            <Receipt /> Expense
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setWhich("income")} className={noAccounts ? "pointer-events-none opacity-50" : ""}>
            <Wallet /> Income
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setWhich("transfer")} className={accounts.length < 2 ? "pointer-events-none opacity-50" : ""}>
            <ArrowLeftRight /> Transfer
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setWhich("cc")} className={noAccounts ? "pointer-events-none opacity-50" : ""}>
            <CreditCard /> Card payment
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setWhich("balance")} className={noAccounts ? "pointer-events-none opacity-50" : ""}>
            <PencilLine /> Update balance
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setWhich("account")}>
            <Landmark /> Add account
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={which !== null} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          {which && (
            <>
              <DialogHeader>
                <DialogTitle>{TITLES[which].title}</DialogTitle>
                <DialogDescription>{TITLES[which].desc}</DialogDescription>
              </DialogHeader>
              {which === "expense" && <ExpenseForm accounts={accounts} categories={categories} onDone={close} />}
              {which === "income" && <IncomeForm accounts={accounts} categories={categories} onDone={close} />}
              {which === "transfer" && <TransferForm accounts={accounts} onDone={close} />}
              {which === "cc" && <CcPaymentForm accounts={accounts} onDone={close} />}
              {which === "balance" && <UpdateBalanceForm accounts={accounts} onDone={close} />}
              {which === "account" && <AccountForm onDone={close} />}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
