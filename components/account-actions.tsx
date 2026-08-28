"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, MoreHorizontal, Pencil, Archive, ArchiveRestore, Trash2, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { AccountForm, type AccountInitial } from "@/components/forms/account-form";
import { Field } from "@/components/forms/form-kit";
import { setAccountStatus, deleteAccount, updateBalance } from "@/app/actions/accounts";

export function AddAccountButton() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus /> Add account
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add account</DialogTitle>
            <DialogDescription>A place where money is stored or owed.</DialogDescription>
          </DialogHeader>
          <AccountForm onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function UpdateBalanceButton({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState("");
  const [note, setNote] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string>();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setPending(true);
    const res = await updateBalance({ accountId, newBalance: value, note });
    setPending(false);
    if (res.ok) {
      router.refresh();
      setOpen(false);
      setValue("");
      setNote("");
    } else setError(res.error);
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <PencilLine /> Update balance
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update balance</DialogTitle>
            <DialogDescription>The change is recorded in this account’s balance history.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-3">
            <Field label="New balance (₹)">
              <Input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder="0" autoFocus />
            </Field>
            <Field label="Note">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
            </Field>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Update"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function AccountRowMenu({ account }: { account: AccountInitial & { status: string } }) {
  const router = useRouter();
  const [edit, setEdit] = React.useState(false);
  const [del, setDel] = React.useState(false);
  const archived = account.status === "archived";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" aria-label="Account actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEdit(true)}>
            <Pencil /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={async () => {
              const res = await setAccountStatus(account.id, archived ? "active" : "archived");
              if (res.ok) router.refresh();
            }}
          >
            {archived ? <ArchiveRestore /> : <Archive />} {archived ? "Unarchive" : "Archive"}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => setDel(true)}>
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={edit} onOpenChange={setEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit account</DialogTitle>
            <DialogDescription>Update account details.</DialogDescription>
          </DialogHeader>
          <AccountForm initial={account} onDone={() => setEdit(false)} />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={del}
        onOpenChange={setDel}
        title={`Delete “${account.name}”?`}
        description="This permanently removes the account. Accounts with transactions can’t be deleted — archive them instead."
        onConfirm={async () => {
          const res = await deleteAccount(account.id);
          if (res.ok) router.refresh();
          return res;
        }}
      />
    </>
  );
}
