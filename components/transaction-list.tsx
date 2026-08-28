"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Receipt, Wallet, ArrowLeftRight, CreditCard, PencilLine, MoreHorizontal, Trash2 } from "lucide-react";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { deleteTransaction } from "@/app/actions/transactions";

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

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export function TransactionList({ items, showAccount = true }: { items: TxnItem[]; showAccount?: boolean }) {
  const router = useRouter();
  const [toDelete, setToDelete] = React.useState<TxnItem | null>(null);

  return (
    <>
      <ul className="divide-y divide-border">
        {items.map((t) => {
          const meta = META[t.type] ?? META.EXPENSE;
          const Icon = meta.Icon;
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
                  <DropdownMenuItem variant="destructive" onClick={() => setToDelete(t)}>
                    <Trash2 /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          );
        })}
      </ul>

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
