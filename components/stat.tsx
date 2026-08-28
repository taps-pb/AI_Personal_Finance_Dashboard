import * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  sub,
  tone = "default",
  className,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  tone?: "default" | "positive" | "negative" | "primary";
  className?: string;
}) {
  const valueTone = {
    default: "text-foreground",
    positive: "text-[var(--success)]",
    negative: "text-destructive",
    primary: "text-primary",
  }[tone];
  return (
    <Card className={cn("p-4", className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular", valueTone)}>{value}</p>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}
