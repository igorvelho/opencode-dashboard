import type { MetricsSummary } from "@shared/types";

function fmt(n: number): string {
  return n.toLocaleString();
}

function fmtCost(n: number): string {
  return "$" + n.toFixed(4);
}

interface CardProps {
  label: string;
  value: string;
}

function Card({ label, value }: CardProps) {
  return (
    <div className="rounded-lg border bg-card p-4 flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
    </div>
  );
}

interface Props {
  data: MetricsSummary;
}

export function StatCards({ data }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <Card label="Total Cost" value={fmtCost(data.totalCost)} />
      <Card label="Input Tokens" value={fmt(data.totalInputTokens)} />
      <Card label="Output Tokens" value={fmt(data.totalOutputTokens)} />
      <Card label="Cache Read" value={fmt(data.totalCacheRead)} />
      <Card label="Sessions" value={fmt(data.totalSessions)} />
      <Card label="Messages" value={fmt(data.totalMessages)} />
    </div>
  );
}
