"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Upload, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OptionSelect } from "@/components/forms/form-kit";
import { parseCSV } from "@/lib/csv";
import { importTransactions, type ImportRow } from "@/app/actions/data";

const TARGETS: { key: keyof ImportRow; label: string; required?: boolean }[] = [
  { key: "date", label: "Date", required: true },
  { key: "amount", label: "Amount", required: true },
  { key: "name", label: "Name", required: true },
  { key: "account", label: "Account", required: true },
  { key: "type", label: "Type (expense/income)" },
  { key: "category", label: "Category" },
  { key: "merchant", label: "Merchant" },
];

const NONE = "__none__";

function guess(headers: string[], key: string): string {
  const i = headers.findIndex((h) => h.toLowerCase().includes(key));
  return i >= 0 ? String(i) : NONE;
}

export function CsvImport() {
  const router = useRouter();
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [rows, setRows] = React.useState<string[][]>([]);
  const [map, setMap] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);
  const [result, setResult] = React.useState<string>();
  const [error, setError] = React.useState<string>();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(undefined);
    setError(undefined);
    const text = await file.text();
    const { headers: h, rows: r } = parseCSV(text);
    setHeaders(h);
    setRows(r);
    const initial: Record<string, string> = {};
    for (const t of TARGETS) initial[t.key] = guess(h, t.key);
    setMap(initial);
  }

  const headerOpts = [{ id: NONE, name: "(none)" }, ...headers.map((h, i) => ({ id: String(i), name: h }))];
  const cell = (row: string[], key: string) => {
    const idx = map[key];
    return idx && idx !== NONE ? row[Number(idx)] ?? "" : "";
  };

  async function doImport() {
    setError(undefined);
    setResult(undefined);
    setPending(true);
    const mapped: ImportRow[] = rows.map((r) => ({
      date: cell(r, "date"),
      amount: cell(r, "amount"),
      name: cell(r, "name"),
      account: cell(r, "account"),
      type: cell(r, "type"),
      category: cell(r, "category"),
      merchant: cell(r, "merchant"),
    }));
    const res = await importTransactions(mapped);
    setPending(false);
    if (res.ok) {
      setResult(`Imported ${res.imported} transaction(s); skipped ${res.skipped} (duplicates, unknown accounts or invalid rows).`);
      router.refresh();
    } else setError(res.error);
  }

  return (
    <div className="space-y-4">
      <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
        <Upload className="size-4" /> Choose CSV file
        <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
      </label>

      {headers.length > 0 && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {TARGETS.map((t) => (
              <div key={t.key} className="grid gap-1">
                <label className="text-xs text-muted-foreground">
                  {t.label} {t.required && <span className="text-destructive">*</span>}
                </label>
                <OptionSelect value={map[t.key] ?? NONE} onChange={(v) => setMap((m) => ({ ...m, [t.key]: v }))} options={headerOpts} placeholder="Column" />
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 text-left text-muted-foreground">
                  {TARGETS.map((t) => (
                    <th key={t.key} className="px-2 py-1.5 font-medium">{t.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    {TARGETS.map((t) => (
                      <td key={t.key} className="whitespace-nowrap px-2 py-1.5">{cell(r, t.key)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            {rows.length} row(s) detected. Accounts are matched by name — create matching accounts first. Exact duplicates are skipped.
          </p>

          <Button onClick={doImport} disabled={pending}>
            {pending ? "Importing…" : `Import ${rows.length} row(s)`}
          </Button>
        </>
      )}

      {result && (
        <p className="flex items-center gap-2 text-sm text-[var(--success)]">
          <CheckCircle2 className="size-4" /> {result}
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
