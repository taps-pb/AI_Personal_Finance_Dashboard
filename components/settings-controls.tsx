"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Upload, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { updateSettings, restoreBackup, deleteAllData } from "@/app/actions/data";

export function SettingsForm({ autoUpdateBalances }: { autoUpdateBalances: boolean }) {
  const router = useRouter();
  const [on, setOn] = React.useState(autoUpdateBalances);
  const [saved, setSaved] = React.useState(false);

  async function toggle(next: boolean) {
    setOn(next);
    setSaved(false);
    const res = await updateSettings({ autoUpdateBalances: next });
    if (res.ok) {
      setSaved(true);
      router.refresh();
    } else setOn(!next);
  }

  return (
    <label className="flex items-start gap-3">
      <input type="checkbox" checked={on} onChange={(e) => toggle(e.target.checked)} className="mt-0.5 size-4 accent-[var(--primary)]" />
      <span className="text-sm">
        <span className="font-medium">Automatic balance updates</span>
        <span className="block text-xs text-muted-foreground">
          When on, adding/editing/deleting transactions adjusts the affected account balances. {saved && <span className="text-[var(--success)]">Saved.</span>}
        </span>
      </span>
    </label>
  );
}

export function RestoreControl() {
  const router = useRouter();
  const [text, setText] = React.useState<string>();
  const [fileName, setFileName] = React.useState<string>();
  const [confirm, setConfirm] = React.useState(false);
  const [result, setResult] = React.useState<string>();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(undefined);
    setText(await file.text());
    setFileName(file.name);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
          <Upload className="size-4" /> Choose backup file
          <input type="file" accept="application/json,.json" className="hidden" onChange={onFile} />
        </label>
        {fileName && <span className="text-xs text-muted-foreground">{fileName}</span>}
        <Button variant="destructive" size="sm" disabled={!text} onClick={() => setConfirm(true)}>
          Restore
        </Button>
      </div>
      {result && <p className="flex items-center gap-1.5 text-sm text-[var(--success)]"><Check className="size-4" /> {result}</p>}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Restore from backup?"
        description="This replaces ALL of your current data with the contents of the backup file. This cannot be undone."
        confirmLabel="Replace all data"
        onConfirm={async () => {
          const res = await restoreBackup(text ?? "");
          if (res.ok) {
            setResult("Backup restored.");
            router.refresh();
          }
          return res;
        }}
      />
    </div>
  );
}

export function DeleteAllControl() {
  const router = useRouter();
  const [confirm, setConfirm] = React.useState(false);
  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setConfirm(true)}>
        Delete all data
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete all your data?"
        description="This permanently removes every account, transaction, subscription, budget and goal. This cannot be undone. Consider exporting a backup first."
        confirmLabel="Delete everything"
        onConfirm={async () => {
          const res = await deleteAllData();
          if (res.ok) router.refresh();
          return res;
        }}
      />
    </>
  );
}
