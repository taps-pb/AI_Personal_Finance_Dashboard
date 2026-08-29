"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Field } from "@/components/forms/form-kit";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { createCategory, updateCategory, deleteCategory } from "@/app/actions/categories";

const COLORS = ["#6366f1", "#f97316", "#3b82f6", "#22c55e", "#ef4444", "#a855f7", "#eab308", "#14b8a6", "#ec4899", "#64748b"];

export interface Cat {
  id: string;
  name: string;
  kind: string;
  parentId?: string | null;
  icon?: string | null;
  color?: string | null;
}

function CategoryDialog({
  open,
  onOpenChange,
  kind,
  parentId,
  initial,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  kind: string;
  parentId?: string | null;
  initial?: Cat;
}) {
  const router = useRouter();
  const editing = !!initial;
  const [name, setName] = React.useState(initial?.name ?? "");
  const [icon, setIcon] = React.useState(initial?.icon ?? "");
  const [color, setColor] = React.useState(initial?.color ?? COLORS[0]);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string>();
  // State resets per open via a `key` on this component in the parent — no effect needed.

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setPending(true);
    const payload = { name, kind, parentId: parentId ?? undefined, icon, color };
    const res = editing ? await updateCategory(initial.id, payload) : await createCategory(payload);
    setPending(false);
    if (res.ok) {
      router.refresh();
      onOpenChange(false);
    } else setError(res.error);
  }

  const title = editing ? "Edit category" : parentId ? "Add subcategory" : "Add category";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{kind === "income" ? "Income" : "Expense"} category.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Groceries" autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Icon (emoji)">
              <Input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="🍔" maxLength={2} />
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
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : editing ? "Save" : "Add"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function KindPanel({ kind, categories }: { kind: string; categories: Cat[] }) {
  const router = useRouter();
  const list = categories.filter((c) => c.kind === kind);
  const parents = list.filter((c) => !c.parentId);
  const childrenOf = (id: string) => list.filter((c) => c.parentId === id);

  const [addOpen, setAddOpen] = React.useState(false);
  const [sub, setSub] = React.useState<{ parentId: string } | null>(null);
  const [edit, setEdit] = React.useState<Cat | null>(null);
  const [del, setDel] = React.useState<Cat | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus /> Add category
        </Button>
      </div>

      {parents.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No {kind} categories yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {parents.map((p) => {
            const subs = childrenOf(p.id);
            return (
              <Card key={p.id} className="p-4">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-full" style={{ background: `${p.color ?? "#6366f1"}22` }}>
                    {p.icon || "🏷️"}
                  </span>
                  <span className="font-medium">{p.name}</span>
                  <Badge className="ml-1">{subs.length}</Badge>
                  <div className="ml-auto">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8" aria-label="Category actions">
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSub({ parentId: p.id })}>
                          <Plus /> Add subcategory
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEdit(p)}>
                          <Pencil /> Rename / edit
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onClick={() => setDel(p)}>
                          <Trash2 /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                {subs.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {subs.map((s) => (
                      <span key={s.id} className="group inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                        {s.icon && <span>{s.icon}</span>}
                        {s.name}
                        <button
                          type="button"
                          onClick={() => setDel(s)}
                          aria-label={`Delete ${s.name}`}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <CategoryDialog key={`add-${addOpen}`} open={addOpen} onOpenChange={setAddOpen} kind={kind} />
      <CategoryDialog key={`sub-${sub?.parentId ?? ""}-${sub !== null}`} open={sub !== null} onOpenChange={(o) => !o && setSub(null)} kind={kind} parentId={sub?.parentId} />
      <CategoryDialog key={`edit-${edit?.id ?? ""}-${edit !== null}`} open={edit !== null} onOpenChange={(o) => !o && setEdit(null)} kind={kind} initial={edit ?? undefined} />
      <ConfirmDialog
        open={del !== null}
        onOpenChange={(o) => !o && setDel(null)}
        title={`Delete “${del?.name}”?`}
        description="Transactions in this category become uncategorized; subcategories are kept as top-level categories. This cannot be undone."
        onConfirm={async () => {
          if (!del) return { ok: false, error: "Nothing selected" };
          const res = await deleteCategory(del.id);
          if (res.ok) router.refresh();
          return res;
        }}
      />
    </div>
  );
}

export function CategoryManager({ categories }: { categories: Cat[] }) {
  return (
    <Tabs defaultValue="expense">
      <TabsList>
        <TabsTrigger value="expense">Expense</TabsTrigger>
        <TabsTrigger value="income">Income</TabsTrigger>
      </TabsList>
      <TabsContent value="expense">
        <KindPanel kind="expense" categories={categories} />
      </TabsContent>
      <TabsContent value="income">
        <KindPanel kind="income" categories={categories} />
      </TabsContent>
    </Tabs>
  );
}
