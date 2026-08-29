"use client";
import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { TXN_TYPES, TXN_TYPE_LABELS } from "@/lib/constants";

interface Opt {
  id: string;
  name: string;
}

const ADV_KEYS = ["min", "max", "from", "to", "recurring"];

export function TransactionFilters({ accounts, categories }: { accounts: Opt[]; categories: Opt[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [q, setQ] = React.useState(searchParams.get("q") ?? "");
  const [min, setMin] = React.useState(searchParams.get("min") ?? "");
  const [max, setMax] = React.useState(searchParams.get("max") ?? "");
  const [showMore, setShowMore] = React.useState(ADV_KEYS.some((k) => searchParams.get(k)));

  const setParam = React.useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all") params.set(key, value);
      else params.delete(key);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  // Debounce free-text + amount inputs.
  React.useEffect(() => {
    const id = setTimeout(() => {
      if ((searchParams.get("q") ?? "") !== q) setParam("q", q);
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  React.useEffect(() => {
    const id = setTimeout(() => {
      if ((searchParams.get("min") ?? "") !== min) setParam("min", min);
    }, 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [min]);
  React.useEffect(() => {
    const id = setTimeout(() => {
      if ((searchParams.get("max") ?? "") !== max) setParam("max", max);
    }, 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [max]);

  const hasFilters =
    ["q", "accountId", "categoryId", "type", ...ADV_KEYS].some((k) => searchParams.get(k));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, merchant, notes…" className="pl-8" />
        </div>

        <FilterSelect placeholder="All accounts" value={searchParams.get("accountId") ?? "all"} onChange={(v) => setParam("accountId", v)} options={accounts} allLabel="All accounts" />
        <FilterSelect placeholder="All categories" value={searchParams.get("categoryId") ?? "all"} onChange={(v) => setParam("categoryId", v)} options={categories} allLabel="All categories" />
        <FilterSelect
          placeholder="All types"
          value={searchParams.get("type") ?? "all"}
          onChange={(v) => setParam("type", v)}
          options={TXN_TYPES.map((t) => ({ id: t, name: TXN_TYPE_LABELS[t] }))}
          allLabel="All types"
        />

        <Button variant={showMore ? "secondary" : "ghost"} size="sm" onClick={() => setShowMore((s) => !s)}>
          <SlidersHorizontal /> More
        </Button>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ("");
              setMin("");
              setMax("");
              router.push(pathname);
            }}
          >
            <X /> Clear
          </Button>
        )}
      </div>

      {showMore && (
        <div className="flex flex-wrap items-end gap-3 rounded-md border border-border p-3">
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">Min ₹</Label>
            <Input value={min} onChange={(e) => setMin(e.target.value)} inputMode="decimal" placeholder="0" className="h-8 w-24" />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">Max ₹</Label>
            <Input value={max} onChange={(e) => setMax(e.target.value)} inputMode="decimal" placeholder="Any" className="h-8 w-24" />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input type="date" value={searchParams.get("from") ?? ""} onChange={(e) => setParam("from", e.target.value)} className="h-8" />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input type="date" value={searchParams.get("to") ?? ""} onChange={(e) => setParam("to", e.target.value)} className="h-8" />
          </div>
          <label className="flex items-center gap-2 pb-1.5 text-sm">
            <input
              type="checkbox"
              checked={searchParams.get("recurring") === "1"}
              onChange={(e) => setParam("recurring", e.target.checked ? "1" : "")}
              className="size-4 accent-[var(--primary)]"
            />
            Recurring only
          </label>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
  allLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Opt[];
  placeholder: string;
  allLabel: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-auto min-w-[140px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
