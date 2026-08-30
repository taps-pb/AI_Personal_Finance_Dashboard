"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, MoreHorizontal, Pencil, Trash2, Receipt, Pause, Play } from "lucide-react";
import { formatINR, compactINR } from "@/lib/money";
import { FREQUENCY_LABELS, type Frequency } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/stat";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SubscriptionForm, type SubInitial } from "@/components/forms/subscription-form";
import type { AcctOpt, CatOpt } from "@/components/forms/txn-forms";
import { recordSubscriptionCharge, setSubscriptionStatus, deleteSubscription } from "@/app/actions/subscriptions";

export interface SubRow {
  id: string;
  name: string;
  provider?: string | null;
  amountMinor: number;
  frequency: string;
  intervalDays?: number | null;
  status: string;
  autoRenew: boolean;
  notes?: string | null;
  accountId?: string | null;
  accountName?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  categoryColor: string;
  startISO: string;
  nextBillingISO: string;
  monthlyMinor: number;
  daysUntil: number;
}

interface Summary {
  monthlyMinor: number;
  annualMinor: number;
  activeCount: number;
  d7: { count: number; amountMinor: number };
  d30: { count: number; amountMinor: number };
  d90: { count: number; amountMinor: number };
  byCategory: { name: string; color: string; amountMinor: number }[];
  mostExpensive: SubRow | null;
}

function dueLabel(days: number) {
  if (days < 0) return { text: "Overdue", variant: "destructive" as const };
  if (days === 0) return { text: "Today", variant: "warning" as const };
  if (days === 1) return { text: "Tomorrow", variant: "warning" as const };
  if (days <= 7) return { text: `in ${days} days`, variant: "warning" as const };
  return { text: `in ${days} days`, variant: "default" as const };
}

function toInitial(s: SubRow): SubInitial {
  return {
    id: s.id,
    name: s.name,
    provider: s.provider,
    amountMinor: s.amountMinor,
    frequency: s.frequency,
    intervalDays: s.intervalDays,
    startISO: s.startISO,
    nextBillingISO: s.nextBillingISO,
    accountId: s.accountId,
    categoryId: s.categoryId,
    autoRenew: s.autoRenew,
    notes: s.notes,
  };
}

export function SubscriptionsManager({
  rows,
  summary,
  accounts,
  categories,
}: {
  rows: SubRow[];
  summary: Summary;
  accounts: AcctOpt[];
  categories: CatOpt[];
}) {
  const router = useRouter();
  const [add, setAdd] = React.useState(false);
  const [edit, setEdit] = React.useState<SubRow | null>(null);
  const [del, setDel] = React.useState<SubRow | null>(null);
  const [busy, setBusy] = React.useState<string>();
  const [error, setError] = React.useState<string>();

  async function record(id: string) {
    setError(undefined);
    setBusy(id);
    const res = await recordSubscriptionCharge(id);
    setBusy(undefined);
    if (res.ok) router.refresh();
    else setError(res.error);
  }
  async function toggle(s: SubRow) {
    setBusy(s.id);
    await setSubscriptionStatus(s.id, s.status === "paused" ? "active" : "paused");
    setBusy(undefined);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Monthly subscriptions" value={formatINR(summary.monthlyMinor)} tone="primary" sub={`${summary.activeCount} active`} />
        <StatCard label="Annual equivalent" value={compactINR(summary.annualMinor)} />
        <StatCard label="Renewing ≤7 days" value={formatINR(summary.d7.amountMinor)} tone={summary.d7.count ? "negative" : "default"} sub={`${summary.d7.count} subscription(s)`} />
        <StatCard label="Renewing ≤30 days" value={formatINR(summary.d30.amountMinor)} sub={`${summary.d30.count} subscription(s)`} />
      </div>

      <p className="text-sm text-muted-foreground">
        You currently spend approximately <span className="font-medium text-foreground">{formatINR(summary.monthlyMinor)}/month</span> or{" "}
        <span className="font-medium text-foreground">{formatINR(summary.annualMinor)}/year</span> on subscriptions.
      </p>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">All subscriptions</h2>
        <Button size="sm" onClick={() => setAdd(true)}>
          <Plus /> Add subscription
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No subscriptions yet. Add the services you pay for regularly.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((s) => {
            const badge = dueLabel(s.daysUntil);
            const paused = s.status === "paused";
            const cancelled = s.status === "cancelled";
            return (
              <Card key={s.id} className="p-4">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{s.name}</span>
                      {paused && <Badge variant="warning">Paused</Badge>}
                      {cancelled && <Badge variant="destructive">Cancelled</Badge>}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {[s.provider, s.categoryName, s.accountName].filter(Boolean).join(" · ") || "No account set"}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8" aria-label="Subscription actions">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => record(s.id)} disabled={busy === s.id || cancelled}>
                        <Receipt /> Record charge
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setEdit(s)}>
                        <Pencil /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggle(s)} disabled={cancelled}>
                        {paused ? <Play /> : <Pause />} {paused ? "Resume" : "Pause"}
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onClick={() => setDel(s)}>
                        <Trash2 /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <p className="text-xl font-semibold tabular">{formatINR(s.amountMinor)}</p>
                    <p className="text-xs text-muted-foreground">
                      {FREQUENCY_LABELS[s.frequency as Frequency] ?? s.frequency} · {formatINR(s.monthlyMinor)}/mo
                    </p>
                  </div>
                  {!paused && !cancelled && <Badge variant={badge.variant}>{badge.text}</Badge>}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {summary.byCategory.length > 0 && (
        <Card className="p-4">
          <h3 className="mb-2 text-sm font-medium">Monthly cost by category</h3>
          <ul className="space-y-2">
            {summary.byCategory.map((c) => (
              <li key={c.name} className="flex items-center gap-2 text-sm">
                <span className="size-2.5 rounded-full" style={{ background: c.color }} />
                <span className="truncate">{c.name}</span>
                <span className="ml-auto font-medium tabular">{formatINR(c.amountMinor)}/mo</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Dialog open={add} onOpenChange={setAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add subscription</DialogTitle>
            <DialogDescription>A service you pay for regularly.</DialogDescription>
          </DialogHeader>
          <SubscriptionForm accounts={accounts} categories={categories} onDone={() => setAdd(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={edit !== null} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit subscription</DialogTitle>
            <DialogDescription>Update this subscription.</DialogDescription>
          </DialogHeader>
          {edit && <SubscriptionForm accounts={accounts} categories={categories} initial={toInitial(edit)} onDone={() => setEdit(null)} />}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={del !== null}
        onOpenChange={(o) => !o && setDel(null)}
        title={`Delete “${del?.name}”?`}
        description="The subscription is removed. Any transactions it already generated are kept."
        onConfirm={async () => {
          if (!del) return { ok: false, error: "Nothing selected" };
          const res = await deleteSubscription(del.id);
          if (res.ok) router.refresh();
          return res;
        }}
      />
    </div>
  );
}
