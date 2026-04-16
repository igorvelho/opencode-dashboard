import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { DailyProviderCost, ProviderMetric } from "@shared/types";
import { buildProviderColourMap, PROVIDER_MUTED } from "@/hooks/useProviderColour";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtDate(d: string): string {
  const [, m, day] = d.split("-");
  return `${MONTHS[parseInt(m) - 1]} ${parseInt(day)}`;
}

interface Props {
  dailyByProvider: DailyProviderCost[];
  providers: ProviderMetric[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}

export function DailyCostChart({ dailyByProvider, providers, selectedDate, onSelectDate }: Props) {
  const colourMap = buildProviderColourMap(providers);

  // Build chart data: one entry per date, with a key per provider
  const providerIds = Array.from(new Set(dailyByProvider.map(e => e.providerId)));
  const dateMap = new Map<string, Record<string, number>>();
  for (const entry of dailyByProvider) {
    if (!dateMap.has(entry.date)) dateMap.set(entry.date, {});
    dateMap.get(entry.date)![entry.providerId] = entry.cost;
  }
  const chartData = Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, provCosts]) => ({
      date,
      dateLabel: fmtDate(date),
      ...provCosts,
    }));

  const handleClick = (data: { date?: string } | null) => {
    if (!data?.date) return;
    onSelectDate(selectedDate === data.date ? null : data.date);
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-medium mb-4">Daily Cost by Provider</h3>
      {chartData.length === 0 ? (
        <p className="text-sm text-muted-foreground">No data for selected range.</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={chartData}
            margin={{ top: 4, right: 8, bottom: 4, left: 8 }}
            onClick={(state) => handleClick((state as { activePayload?: Array<{ payload: { date?: string } }> } | null)?.activePayload?.[0]?.payload ?? null)}
            style={{ cursor: "pointer" }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => `$${v.toFixed(0)}`}
            />
            <Tooltip
              formatter={(value, name) => [`$${(value as number).toFixed(2)}`, name as string]}
              labelFormatter={(label) => `Date: ${label as string}`}
            />
            {providerIds.map((pid) => (
              <Bar
                key={pid}
                dataKey={pid}
                stackId="cost"
                fill={colourMap[pid] ?? PROVIDER_MUTED}
                radius={providerIds.indexOf(pid) === providerIds.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
              >
                {chartData.map((entry) => (
                  <Cell
                    key={entry.date}
                    opacity={selectedDate && selectedDate !== entry.date ? 0.4 : 1}
                    stroke={selectedDate === entry.date ? "white" : "none"}
                    strokeWidth={selectedDate === entry.date ? 1 : 0}
                  />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
      {selectedDate && (
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Click the same bar again or use × to deselect
        </p>
      )}
    </div>
  );
}
