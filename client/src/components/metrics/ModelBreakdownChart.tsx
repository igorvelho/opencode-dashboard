import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ModelMetric } from "@shared/types";

interface Props {
  data: ModelMetric[];
}

export function ModelBreakdownChart({ data }: Props) {
  const formatted = data.map((m) => ({
    ...m,
    label: m.modelId,
  }));

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-medium mb-4">Cost by Model</h3>
      <ResponsiveContainer width="100%" height={Math.max(180, formatted.length * 40)}>
        <BarChart
          data={formatted}
          layout="vertical"
          margin={{ top: 4, right: 40, bottom: 4, left: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            type="number"
            tick={{ fontSize: 12 }}
            tickFormatter={(v: number) => `$${v.toFixed(3)}`}
          />
          <YAxis type="category" dataKey="label" tick={{ fontSize: 12 }} width={160} />
          <Tooltip
            formatter={(v: number) => [`$${v.toFixed(4)}`, "Cost"]}
            labelFormatter={(label: string) => `Model: ${label}`}
          />
          <Bar dataKey="cost" fill="hsl(var(--primary))" radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
