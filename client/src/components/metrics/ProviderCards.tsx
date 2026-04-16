import type { ProviderMetric } from "@shared/types";
import { buildProviderColourMap, PROVIDER_MUTED } from "@/hooks/useProviderColour";

interface Props {
  providers: ProviderMetric[];
  totalCost: number;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ProviderCards({ providers = [], totalCost }: Props) {
  if (!providers || providers.length === 0) return null;

  const colourMap = buildProviderColourMap(providers);

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-medium mb-4">Cost by Provider</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {providers.map((p) => {
          const colour = colourMap[p.providerId];
          const pct = totalCost > 0 ? (p.cost / totalCost) * 100 : 0;
          const isMuted = colour === PROVIDER_MUTED;

          return (
            <div
              key={p.providerId}
              className="rounded-md border bg-background p-3 flex flex-col gap-2"
              style={{ borderLeftColor: colour, borderLeftWidth: 3 }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: isMuted ? "var(--muted-foreground)" : colour }}
                >
                  {p.providerId}
                </span>
                <span className="text-xs text-muted-foreground">
                  {p.messageCount.toLocaleString()} msgs
                </span>
              </div>
              <div className="flex items-end justify-between gap-2">
                <span className="text-xl font-bold">
                  {isMuted ? "—" : `$${fmt(p.cost)}`}
                </span>
                <span className="text-xs text-muted-foreground mb-0.5">
                  {pct > 0 ? `${pct.toFixed(1)}% of total` : "no cost data"}
                </span>
              </div>
              <div className="h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: colour }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
