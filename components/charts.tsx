"use client";
import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { compactINR, formatINR } from "@/lib/money";

const axisProps = {
  stroke: "var(--muted-foreground)",
  fontSize: 12,
  tickLine: false,
  axisLine: false,
} as const;

function TooltipBox({ rows }: { rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          {r.color && <span className="size-2 rounded-full" style={{ background: r.color }} />}
          <span className="text-muted-foreground">{r.label}</span>
          <span className="ml-auto font-medium tabular">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

export function NetWorthChart({ data }: { data: { label: string; netWorthMinor: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <defs>
          <linearGradient id="nw" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} width={64} tickFormatter={(v: number) => compactINR(v)} />
        <Tooltip
          cursor={{ stroke: "var(--border)" }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TooltipBox rows={[{ label: "Net worth", value: formatINR(payload[0].value as number), color: "var(--primary)" }]} />
            ) : null
          }
        />
        <Area type="monotone" dataKey="netWorthMinor" stroke="var(--primary)" strokeWidth={2} fill="url(#nw)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function BalanceHistoryChart({ data }: { data: { label: string; balanceMinor: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <defs>
          <linearGradient id="bal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} width={64} tickFormatter={(v: number) => compactINR(v)} />
        <Tooltip
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TooltipBox rows={[{ label: "Balance", value: formatINR(payload[0].value as number), color: "var(--primary)" }]} />
            ) : null
          }
        />
        <Area type="monotone" dataKey="balanceMinor" stroke="var(--primary)" strokeWidth={2} fill="url(#bal)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function IncomeExpenseChart({ data }: { data: { label: string; incomeMinor: number; spendingMinor: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} width={64} tickFormatter={(v: number) => compactINR(v)} />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.4 }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TooltipBox
                rows={[
                  { label: "Income", value: formatINR((payload.find((p) => p.dataKey === "incomeMinor")?.value as number) ?? 0), color: "var(--success)" },
                  { label: "Spending", value: formatINR((payload.find((p) => p.dataKey === "spendingMinor")?.value as number) ?? 0), color: "var(--primary)" },
                ]}
              />
            ) : null
          }
        />
        <Bar dataKey="incomeMinor" fill="var(--success)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="spendingMinor" fill="var(--primary)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CategoryDonut({ data }: { data: { name: string; amountMinor: number; color: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="amountMinor" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2} strokeWidth={0}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
        </Pie>
        <Tooltip
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TooltipBox
                rows={[
                  {
                    label: (payload[0].payload as { name: string }).name,
                    value: formatINR(payload[0].value as number),
                    color: (payload[0].payload as { color: string }).color,
                  },
                ]}
              />
            ) : null
          }
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
