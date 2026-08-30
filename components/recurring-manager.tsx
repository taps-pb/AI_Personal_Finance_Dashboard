"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, MoreHorizontal, Pencil, Trash2, PlayCircle } from "lucide-react";
import { formatINR } from "@/lib/money";
import { FREQUENCY_LABELS, TXN_TYPE_LABELS, type Frequency, type TxnType } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { RecurringForm, type RecurInitial } from "@/components/forms/recurring-form";
import type { AcctOpt, CatOpt } from "@/components/forms/txn-forms";
import { recordRecurring, deleteRecurring } from "@/app/actions/recurring";

export interface RecurRow {
  id: string;
  type: string;
  name: string;
  amountMinor: number;
  frequency: string;
  intervalDays?: number | null;
  accountId: string;
  accountName: string;
  toAccountId?: string | null;
  toAccountName?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  nextISO: string;
  daysUntil: number;
  notes?: string | null;
}

function dueLabel(days: number) {
  if (days < 0) return { text: `Overdue ${-days}d`, variant: "destructive" as const };
  if (days === 0) return { text: "Due today", variant: "warning" as const };
  if (days <= 7) return { text: `in ${days} days`, variant: "warning" as const };
  return { text: `in ${days} days`, variant: "default" as const };
}

function toInitial(r: RecurRow): RecurInitial {
  return {
    id: r.id,
    type: r.type,
    amountMinor: r.amountMinor,
    name: r.name,
    accountId: r.accountId,
    toAccountId: r.toAccountId,
    categoryId: r.categoryId,
    frequency: r.frequency,
    intervalDays: r.intervalDays,
    nextISO: r.nextISO,
    notes: r.notes,
  };
}

export function RecurringManager({ rows, accounts, categories }: { rows: RecurRow[]; accounts: AcctOpt[]; categories: CatOpt[] }) {
  const router = useRouter();
  const [add, setAdd] = React.useState(false);
  const [edit, setEdit] = React.useState<RecurRow | null>(null);
  const [del, setDel] = React.useState<RecurRow | null>(null);
  const [busy, setBusy] = React.useState<string>();
  const [error, setError] = React.useState<string>();

  async function record(id: string) {
    setError(undefined);
    setBusy(id);
    const res = await recordRecurring(id);
    setBusy(undefined);
    if (res.ok) router.refresh();
    else setError(res.error);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">Recurring transactions</h2>
        <Button size="sm" onClick={() => setAdd(true)} disabled={accounts.length === 0}>
          <Plus /> Add recurring
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Salary, rent, EMIs, SIPs and the like. “Record now” posts the transaction and advances the next date.</p>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No recurring transactions yet.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {rows.map((r) => {
            const badge = dueLabel(r.daysUntil);
            const dest = r.type === "TRANSFER" ? `${r.accountName} → ${r.toAccountName ?? ""}` : r.accountName;
            return (
              <li key={r.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{r.name}</span>
                    <Badge>{TXN_TYPE_LABELS[r.type as TxnType] ?? r.type}</Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {[FREQUENCY_LABELS[r.frequency as Frequency] ?? r.frequency, r.categoryName, dest].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular">{formatINR(r.amountMinor)}</p>
                  <Badge variant={badge.variant}>{badge.text}</Badge>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8" aria-label="Recurring actions">
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => record(r.id)} disabled={busy === r.id}>
                      <PlayCircle /> Record now
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setEdit(r)}>
                      <Pencil /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onClick={() => setDel(r)}>
                      <Trash2 /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={add} onOpenChange={setAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add recurring transaction</DialogTitle>
            <DialogDescription>A payment or income that repeats on a schedule.</DialogDescription>
          </DialogHeader>
          <RecurringForm accounts={accounts} categories={categories} onDone={() => setAdd(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={edit !== null} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit recurring transaction</DialogTitle>
            <DialogDescription>Update this schedule.</DialogDescription>
          </DialogHeader>
          {edit && <RecurringForm accounts={accounts} categories={categories} initial={toInitial(edit)} onDone={() => setEdit(null)} />}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={del !== null}
        onOpenChange={(o) => !o && setDel(null)}
        title={`Delete “${del?.name}”?`}
        description="The schedule is removed. Transactions it already generated are kept."
        onConfirm={async () => {
          if (!del) return { ok: false, error: "Nothing selected" };
          const res = await deleteRecurring(del.id);
          if (res.ok) router.refresh();
          return res;
        }}
      />
    </div>
  );
}
