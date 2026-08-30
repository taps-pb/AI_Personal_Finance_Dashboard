"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { formatINR } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field, OptionSelect } from "@/components/forms/form-kit";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { upsertBudget, deleteBudget } from "@/app/actions/budgets";

export interface BudgetRow {
  id: string;
  categoryId: string | null;
  name: string;
  color: string;
  amountMinor: number;
  spentMinor: number;
  remainingMinor: number;
  pct: number;
  status: string;
  projectedMinor: number;
}

const OVERALL = "__overall__";

const STATUS_META: Record<string, { label: string; bar: string; variant: "success" | "warning" | "destructive" | "default" }> = {
  normal: { label: "On track", bar: "bg-[var(--success)]", variant: "success" },
  approaching: { label: "Approaching", bar: "bg-[var(--warning)]", variant: "warning" },
  warning: { label: "Near limit", bar: "bg-[var(--warning)]", variant: "warning" },
  exceeded: { label: "Over budget", bar: "bg-destructive", variant: "destructive" },
};

function BudgetDialog({
  open,
  onOpenChange,
  availableCategories,
  hasOverall,
  initial,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  availableCategories: { id: string; name: string }[];
  hasOverall: boolean;
  initial?: { categoryId: string | null; name: string; amountMinor: number };
}) {
  const router = useRouter();
  const editing = !!initial;
  const [target, setTarget] = React.useState(initial ? initial.categoryId ?? OVERALL : hasOverall ? (availableCategories[0]?.id ?? "") : OVERALL);
  const [amount, setAmount] = React.useState(initial ? String(initial.amountMinor / 100) : "");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string>();

  const options = [
    ...(!hasOverall || (initial && initial.categoryId === null) ? [{ id: OVERALL, name: "Overall monthly" }] : []),
    ...availableCategories,
    ...(initial && initial.categoryId ? [{ id: initial.categoryId, name: initial.name }] : []),
  ];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setPending(true);
    const res = await upsertBudget({ categoryId: target === OVERALL ? "" : target, amount });
    setPending(false);
    if (res.ok) {
      router.refresh();
      onOpenChange(false);
    } else setError(res.error);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit budget" : "Set budget"}</DialogTitle>
          <DialogDescription>Monthly spending limit.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <Field label="Applies to">
            <OptionSelect value={target} onChange={setTarget} options={options} placeholder="Category" />
          </Field>
          <Field label="Monthly limit (₹)">
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0" autoFocus />
          </Field>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function BudgetManager({
  rows,
  availableCategories,
  hasOverall,
}: {
  rows: BudgetRow[];
  availableCategories: { id: string; name: string }[];
  hasOverall: boolean;
}) {
  const router = useRouter();
  const [add, setAdd] = React.useState(false);
  const [edit, setEdit] = React.useState<BudgetRow | null>(null);
  const [del, setDel] = React.useState<BudgetRow | null>(null);
  const canAdd = availableCategories.length > 0 || !hasOverall;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">Monthly budgets</h2>
        <Button size="sm" onClick={() => setAdd(true)} disabled={!canAdd}>
          <Plus /> Set budget
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No budgets yet. Set a monthly limit overall or per category to track your spending.
        </p>
      ) : (
        <div className="grid gap-3">
          {rows.map((b) => {
            const meta = STATUS_META[b.status] ?? STATUS_META.normal;
            return (
              <Card key={b.id} className="p-4">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: b.color }} />
                  <span className="font-medium">{b.name}</span>
                  <Badge variant={meta.variant} className="ml-1">
                    {meta.label}
                  </Badge>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-sm tabular text-muted-foreground">
                      {formatINR(b.spentMinor)} <span className="opacity-60">/ {formatINR(b.amountMinor)}</span>
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8" aria-label="Budget actions">
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEdit(b)}>
                          <Pencil /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onClick={() => setDel(b)}>
                          <Trash2 /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full ${meta.bar}`} style={{ width: `${Math.min(b.pct, 100)}%` }} />
                </div>
                <div className="mt-2 flex flex-wrap justify-between gap-x-4 text-xs text-muted-foreground">
                  <span>{b.pct.toFixed(0)}% used</span>
                  <span>{b.remainingMinor >= 0 ? `${formatINR(b.remainingMinor)} left` : `${formatINR(-b.remainingMinor)} over`}</span>
                  <span>Projected month-end: {formatINR(b.projectedMinor)}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <BudgetDialog open={add} onOpenChange={setAdd} availableCategories={availableCategories} hasOverall={hasOverall} />
      {edit && (
        <BudgetDialog
          key={edit.id}
          open
          onOpenChange={(o) => !o && setEdit(null)}
          availableCategories={availableCategories}
          hasOverall={hasOverall}
          initial={{ categoryId: edit.categoryId, name: edit.name, amountMinor: edit.amountMinor }}
        />
      )}

      <ConfirmDialog
        open={del !== null}
        onOpenChange={(o) => !o && setDel(null)}
        title={`Delete the ${del?.name} budget?`}
        description="This removes the budget. Your transactions are unaffected."
        onConfirm={async () => {
          if (!del) return { ok: false, error: "Nothing selected" };
          const res = await deleteBudget(del.id);
          if (res.ok) router.refresh();
          return res;
        }}
      />
    </div>
  );
}
