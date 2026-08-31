"use client";
import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { RANGES, type RangeKey } from "@/lib/ranges";

export function RangeSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = (searchParams.get("range") as RangeKey) ?? "30d";

  function setRange(range: RangeKey) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", range);
    if (range !== "custom") {
      params.delete("from");
      params.delete("to");
    }
    router.push(`${pathname}?${params.toString()}`);
  }
  function setDate(key: "from" | "to", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", "custom");
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              active === r.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent",
            )}
          >
            {r.label}
          </button>
        ))}
      </div>
      {active === "custom" && (
        <div className="flex flex-wrap items-center gap-2">
          <Input type="date" value={searchParams.get("from") ?? ""} onChange={(e) => setDate("from", e.target.value)} className="h-8 w-auto" />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="date" value={searchParams.get("to") ?? ""} onChange={(e) => setDate("to", e.target.value)} className="h-8 w-auto" />
        </div>
      )}
    </div>
  );
}
