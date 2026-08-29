"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Receipt, Wallet, ArrowLeftRight, CreditCard, PencilLine, MoreHorizontal, Trash2, Pencil } from "lucide-react";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { deleteTransaction } from "@/app/actions/transactions";
import {
  ExpenseForm,
  IncomeForm,
  TransferForm,
  CcPaymentForm,
  type AcctOpt,
  type CatOpt,
  type TxnInitial,
} from "@/components/forms/txn-forms";

export interface TxnItem {
  id: string;
  type: string;
  name: string;
  amountMinor: number;
  date: string;
  accountName?: string;
  toAccountName?: string | null;
  categoryName?: string | null;
  merchant?: string | null;
  // optional fields that enable in-place editing
  accountId?: string;
  toAccountId?: string | null;
  categoryId?: string | null;
  feeMinor?: number | null;
  paymentMethod?: string | null;
  description?: string | null;
}

const META: Record<string, { Icon: React.ComponentType<{ className?: string }>; sign: string; tone: string }> = {
  EXPENSE: { Icon: Receipt, sign: "−", tone: "text-destructive" },
  INCOME: { Icon: Wallet, sign: "+", tone: "text-[var(--success)]" },
  REFUND: { Icon: Wallet, sign: "+", tone: "text-[var(--success)]" },
  TRANSFER: { Icon: ArrowLeftRight, sign: "", tone: "text-muted-foreground" },
  CREDIT_CARD_PAYMENT: { Icon: CreditCard, sign: "", tone: "text-muted-foreground" },
  BALANCE_ADJUSTMENT: { Icon: PencilLine, sign: "", tone: "text-muted-foreground" },
  INVESTMENT: { Icon: ArrowLeftRight, sign: "", tone: "text-muted-foreground" },
};

const EDITABLE = new Set(["EXPENSE", "INCOME", "TRANSFER", "CREDIT_CARD_PAYMENT"]);

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function toInitial(t: TxnItem): TxnInitial {
  return {
    id: t.id,
    amountMinor: t.amountMinor,
    accountId: t.accountId ?? "",
    toAccountId: t.toAccountId,
    categoryId: t.categoryId,
    feeMinor: t.feeMinor,
    name: t.name,
    dateISO: t.date,
    merchant: t.merchant,
    paymentMethod: t.paymentMethod,
    description: t.description,
  };
}

export function TransactionList({
  items,
  showAccount = true,
  accounts,
  categories,
}: {
  items: TxnItem[];
  showAccount?: boolean;
  accounts?: AcctOpt[];
  categories?: CatOpt[];
}) {
  const router = useRouter();
  const [toDelete, setToDelete] = React.useState<TxnItem | null>(null);
  const [toEdit, setToEdit] = React.useState<TxnItem | null>(null);
  const canEdit = !!accounts && !!categories;

  return (
    <>
      <ul className="divide-y divide-border">
        {items.map((t) => {
          const meta = META[t.type] ?? META.EXPENSE;
          const Icon = meta.Icon;
          const editable = canEdit && EDITABLE.has(t.type) && !!t.accountId;
          const sub = [
            t.categoryName,
            t.merchant,
            showAccount ? (t.type === "TRANSFER" || t.type === "CREDIT_CARD_PAYMENT" ? `${t.accountName} → ${t.toAccountName ?? ""}` : t.accountName) : null,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <li key={t.id} className="flex items-center gap-3 py-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Icon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{t.name}</p>
                {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
              </div>
              <div className="text-right">
                <p className={cn("text-sm font-semibold tabular", meta.tone)}>
                  {meta.sign}
                  {formatINR(t.amountMinor)}
                </p>
                <p className="text-xs text-muted-foreground">{fmtDate(t.date)}</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-8" aria-label="Transaction actions">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {editable && (
                    <DropdownMenuItem onClick={() => setToEdit(t)}>
                      <Pencil /> Edit
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem variant="destructive" onClick={() => setToDelete(t)}>
                    <Trash2 /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          );
        })}
      </ul>

      {canEdit && (
        <Dialog open={toEdit !== null} onOpenChange={(o) => !o && setToEdit(null)}>
          <DialogContent>
            {toEdit && (
              <>
                <DialogHeader>
                  <DialogTitle>Edit transaction</DialogTitle>
                  <DialogDescription>Balances are recalculated automatically.</DialogDescription>
                </DialogHeader>
                {toEdit.type === "EXPENSE" && <ExpenseForm accounts={accounts!} categories={categories!} initial={toInitial(toEdit)} onDone={() => setToEdit(null)} />}
                {toEdit.type === "INCOME" && <IncomeForm accounts={accounts!} categories={categories!} initial={toInitial(toEdit)} onDone={() => setToEdit(null)} />}
                {toEdit.type === "TRANSFER" && <TransferForm accounts={accounts!} initial={toInitial(toEdit)} onDone={() => setToEdit(null)} />}
                {toEdit.type === "CREDIT_CARD_PAYMENT" && <CcPaymentForm accounts={accounts!} initial={toInitial(toEdit)} onDone={() => setToEdit(null)} />}
              </>
            )}
          </DialogContent>
        </Dialog>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete transaction?"
        description={
          toDelete
            ? `“${toDelete.name}” (${formatINR(toDelete.amountMinor)}) will be removed and its effect on account balances reversed.`
            : ""
        }
        onConfirm={async () => {
          if (!toDelete) return { ok: false, error: "Nothing selected" };
          const res = await deleteTransaction(toDelete.id);
          if (res.ok) router.refresh();
          return res;
        }}
      />
    </>
  );
}
