import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { DailyMetric } from "@shared/types";
import { CHART_COLORS } from "./chartColors";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtDate(d: string): string {
  const [, m, day] = d.split("-");
  return `${MONTHS[parseInt(m) - 1]} ${parseInt(day)}`;
}

function fmtTokens(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

interface Props {
  data: DailyMetric[];
}

export function DailyTokensChart({ data }: Props) {
  // Ensure we have defaults and explicit number types so Recharts stacks correctly
  const formatted = data.map((d) => ({
    ...d,
    inputTokens: Number(d.inputTokens || 0),
    outputTokens: Number(d.outputTokens || 0),
    cacheReadTokens: Number(d.cacheReadTokens || 0),
    cacheWriteTokens: Number(d.cacheWriteTokens || 0),
    dateLabel: fmtDate(d.date)
  }));

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-medium mb-4">Daily Token Usage</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={formatted} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="dateLabel" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={fmtTokens} />
          <Tooltip formatter={((v: number, name: string) => [v.toLocaleString(), name]) as unknown as undefined} />
          <Legend />
          <Bar
            dataKey="inputTokens"
            name="Input"
            stackId="tokens"
            fill={CHART_COLORS[0]}
          />
          <Bar
            dataKey="cacheReadTokens"
            name="Cache Read"
            stackId="tokens"
            fill={CHART_COLORS[2]}
          />
          <Bar
            dataKey="cacheWriteTokens"
            name="Cache Write"
            stackId="tokens"
            fill={CHART_COLORS[3]}
          />
          <Bar
            dataKey="outputTokens"
            name="Output"
            stackId="tokens"
            fill={CHART_COLORS[1]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
