import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ModelMetric, ProviderMetric } from "@shared/types";
import { buildProviderColourMap, PROVIDER_MUTED } from "@/hooks/useProviderColour";

interface Props {
  models: ModelMetric[];
  providers: ProviderMetric[];
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ModelBreakdownChart({ models, providers }: Props) {
  const colourMap = buildProviderColourMap(providers);

  // Sort providers by cost desc (same order as ProviderCards)
  const sortedProviders = [...providers].sort((a, b) => b.cost - a.cost);
  const defaultTab = sortedProviders[0]?.providerId ?? "";
  const [activeTab, setActiveTab] = useState<string>(defaultTab);

  // Reset to default tab if providers change and activeTab is no longer valid
  const validTab = sortedProviders.find(p => p.providerId === activeTab)
    ? activeTab
    : defaultTab;

  const tabModels = models
    .filter(m => m.providerId === validTab)
    .sort((a, b) => b.cost - a.cost);

  if (providers.length === 0) return null;

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-medium mb-3">Cost by Model</h3>

      {/* Tab row */}
      <div className="flex gap-1 flex-wrap mb-4 border-b pb-2">
        {sortedProviders.map(p => {
          const colour = colourMap[p.providerId];
          const isActive = p.providerId === validTab;
          return (
            <button
              key={p.providerId}
              onClick={() => setActiveTab(p.providerId)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                isActive
                  ? "text-white"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              style={isActive ? { backgroundColor: colour } : {}}
            >
              {p.providerId}
              {p.cost > 0 && (
                <span className={`ml-1.5 ${isActive ? "opacity-75" : ""}`}>
                  ${fmt(p.cost)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Model breakdown for active tab */}
      {tabModels.length === 0 ? (
        <p className="text-sm text-muted-foreground">No cost data for this provider.</p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(140, tabModels.length * 40)}>
          <BarChart
            data={tabModels}
            layout="vertical"
            margin={{ top: 4, right: 60, bottom: 4, left: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              type="number"
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => `$${v.toFixed(2)}`}
            />
            <YAxis
              type="category"
              dataKey="modelId"
              tick={{ fontSize: 11 }}
              width={160}
            />
            <Tooltip
              formatter={(v: number) => [`$${fmt(v)}`, "Cost"]}
              labelFormatter={(label: string) => `Model: ${label}`}
            />
            <Bar
              dataKey="cost"
              fill={colourMap[validTab] ?? PROVIDER_MUTED}
              radius={[0, 3, 3, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
