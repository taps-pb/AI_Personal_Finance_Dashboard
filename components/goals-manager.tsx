"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, MoreHorizontal, Pencil, Trash2, PiggyBank, CheckCircle2 } from "lucide-react";
import { formatINR } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/forms/form-kit";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { GoalForm, type GoalInitial } from "@/components/forms/goal-form";
import type { AcctOpt } from "@/components/forms/txn-forms";
import { contributeGoal, deleteGoal } from "@/app/actions/goals";

export interface GoalRow {
  id: string;
  name: string;
  targetMinor: number;
  currentMinor: number;
  targetISO: string | null;
  targetDaysUntil: number | null;
  priority: string;
  notes?: string | null;
  linkedAccountId?: string | null;
  linkedAccountName?: string | null;
  pct: number;
  remainingMinor: number;
  reached: boolean;
  monthlyRequiredMinor: number | null;
}

const PRIORITY_VARIANT: Record<string, "destructive" | "warning" | "default"> = { high: "destructive", medium: "warning", low: "default" };

function ContributeDialog({ goal, open, onOpenChange }: { goal: GoalRow; open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [amount, setAmount] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string>();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setPending(true);
    const res = await contributeGoal(goal.id, { amount });
    setPending(false);
    if (res.ok) {
      router.refresh();
      onOpenChange(false);
    } else setError(res.error);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add to “{goal.name}”</DialogTitle>
          <DialogDescription>Record money saved toward this goal. Use a negative amount to withdraw.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <Field label="Amount (₹)">
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0" autoFocus />
          </Field>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Add"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function GoalsManager({ rows, accounts }: { rows: GoalRow[]; accounts: AcctOpt[] }) {
  const router = useRouter();
  const [add, setAdd] = React.useState(false);
  const [edit, setEdit] = React.useState<GoalRow | null>(null);
  const [del, setDel] = React.useState<GoalRow | null>(null);
  const [contribute, setContribute] = React.useState<GoalRow | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">Savings goals</h2>
        <Button size="sm" onClick={() => setAdd(true)}>
          <Plus /> Add goal
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No goals yet. Add one to track progress toward something you’re saving for.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((g) => (
            <Card key={g.id} className="p-4">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {g.reached ? <CheckCircle2 className="size-4" /> : <PiggyBank className="size-4" />}
                </span>
                <span className="font-medium">{g.name}</span>
                {g.reached ? <Badge variant="success">Reached</Badge> : <Badge variant={PRIORITY_VARIANT[g.priority] ?? "default"}>{g.priority}</Badge>}
                <div className="ml-auto">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8" aria-label="Goal actions">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setContribute(g)}>
                        <Plus /> Add money
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setEdit(g)}>
                        <Pencil /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onClick={() => setDel(g)}>
                        <Trash2 /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <p className="mt-3 text-sm tabular">
                <span className="font-semibold">{formatINR(g.currentMinor)}</span>
                <span className="text-muted-foreground"> / {formatINR(g.targetMinor)}</span>
              </p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(g.pct, 100)}%` }} />
              </div>
              <div className="mt-2 flex flex-wrap justify-between gap-x-4 text-xs text-muted-foreground">
                <span>{g.pct.toFixed(0)}%</span>
                {!g.reached && <span>{formatINR(g.remainingMinor)} to go</span>}
                {g.monthlyRequiredMinor != null && !g.reached && <span>{formatINR(g.monthlyRequiredMinor)}/mo needed</span>}
                {g.targetISO && <span>by {new Date(g.targetISO).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</span>}
              </div>
              {g.linkedAccountName && <p className="mt-1 text-xs text-muted-foreground">Linked: {g.linkedAccountName}</p>}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={add} onOpenChange={setAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add savings goal</DialogTitle>
            <DialogDescription>Something you’re saving toward.</DialogDescription>
          </DialogHeader>
          <GoalForm accounts={accounts} onDone={() => setAdd(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={edit !== null} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit goal</DialogTitle>
            <DialogDescription>Update this goal. Use “Add money” to change the saved amount.</DialogDescription>
          </DialogHeader>
          {edit && (
            <GoalForm
              accounts={accounts}
              initial={{ id: edit.id, name: edit.name, targetMinor: edit.targetMinor, targetISO: edit.targetISO, linkedAccountId: edit.linkedAccountId, priority: edit.priority, notes: edit.notes } as GoalInitial}
              onDone={() => setEdit(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {contribute && <ContributeDialog goal={contribute} open onOpenChange={(o) => !o && setContribute(null)} />}

      <ConfirmDialog
        open={del !== null}
        onOpenChange={(o) => !o && setDel(null)}
        title={`Delete “${del?.name}”?`}
        description="This removes the goal. Your accounts are unaffected."
        onConfirm={async () => {
          if (!del) return { ok: false, error: "Nothing selected" };
          const res = await deleteGoal(del.id);
          if (res.ok) router.refresh();
          return res;
        }}
      />
    </div>
  );
}
