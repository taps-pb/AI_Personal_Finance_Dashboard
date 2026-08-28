"use client";
import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

export function TransactionFilters({
  accounts,
  categories,
}: {
  accounts: Opt[];
  categories: Opt[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [q, setQ] = React.useState(searchParams.get("q") ?? "");

  const setParam = React.useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all") params.set(key, value);
      else params.delete(key);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  // Debounce free-text search.
  React.useEffect(() => {
    const id = setTimeout(() => {
      if ((searchParams.get("q") ?? "") !== q) setParam("q", q);
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const hasFilters = ["q", "accountId", "categoryId", "type"].some((k) => searchParams.get(k));

  return (
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

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQ("");
            router.push(pathname);
          }}
        >
          <X /> Clear
        </Button>
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
