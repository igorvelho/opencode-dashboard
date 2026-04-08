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
  const formatted = data.map((d) => ({ ...d, dateLabel: fmtDate(d.date) }));

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-medium mb-4">Daily Token Usage</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={formatted} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="dateLabel" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={fmtTokens} />
          <Tooltip formatter={(v: number) => [v.toLocaleString(), ""]} />
          <Legend />
          <Bar
            dataKey="inputTokens"
            name="Input"
            stackId="tokens"
            fill={CHART_COLORS[0]}
          />
          <Bar
            dataKey="outputTokens"
            name="Output"
            stackId="tokens"
            fill={CHART_COLORS[1]}
            radius={[3, 3, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
