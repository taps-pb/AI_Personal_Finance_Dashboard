// Analytics time ranges — no server deps, safe to import from client components.
export type RangeKey = "7d" | "30d" | "this" | "last" | "3m" | "6m" | "1y" | "all" | "custom";

export const RANGES: { key: RangeKey; label: string }[] = [
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "this", label: "This month" },
  { key: "last", label: "Last month" },
  { key: "3m", label: "3M" },
  { key: "6m", label: "6M" },
  { key: "1y", label: "1Y" },
  { key: "all", label: "All" },
  { key: "custom", label: "Custom" },
];
