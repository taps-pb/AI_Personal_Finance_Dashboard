"use client";
import * as React from "react";
import { Plus, Receipt, Wallet, ArrowLeftRight, CreditCard, PencilLine, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AccountForm } from "@/components/forms/account-form";
import { UpdateBalanceInlineForm } from "@/components/forms/update-balance-form";
import {
  ExpenseForm,
  IncomeForm,
  TransferForm,
  CcPaymentForm,
  type AcctOpt,
  type CatOpt,
} from "@/components/forms/txn-forms";

export type { AcctOpt, CatOpt };

type Which = null | "expense" | "income" | "transfer" | "cc" | "balance" | "account";

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
              {which === "balance" && <UpdateBalanceInlineForm accounts={accounts} onDone={close} />}
              {which === "account" && <AccountForm onDone={close} />}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
