import type { DailyProviderCost, ModelMetric } from "@shared/types";
import { buildProviderColourMap } from "@/hooks/useProviderColour";
import type { ProviderMetric } from "@shared/types";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  date: string; // YYYY-MM-DD
  dailyByProvider: DailyProviderCost[];
  models: ModelMetric[];
  providers: ProviderMetric[];
  onClose: () => void;
  onNavigate: (date: string) => void;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtDate(d: string): string {
  const [y, m, day] = d.split("-");
  return `${MONTHS[parseInt(m) - 1]} ${parseInt(day)}, ${y}`;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function DayDetailPanel({
  date,
  dailyByProvider = [],
  models = [],
  providers = [],
  onClose,
  onNavigate,
}: Props) {
  if (!dailyByProvider || !models || !providers) return null;

  const colourMap = buildProviderColourMap(providers);

  // All dates that have data
  const allDates = Array.from(new Set(dailyByProvider.map(e => e.date))).sort();
  const currentIdx = allDates.indexOf(date);
  const prevDate = currentIdx > 0 ? allDates[currentIdx - 1] : null;
  const nextDate = currentIdx < allDates.length - 1 ? allDates[currentIdx + 1] : null;

  // Provider rows for selected date
  const providerRows = dailyByProvider.filter(e => e.date === date && e.cost > 0);
  const dayTotal = providerRows.reduce((sum, e) => sum + e.cost, 0);

  // Model rows for selected date, filtered to providers active on this day
  const dayModels = models.filter(m => {
    const activeProviders = new Set(providerRows.map(e => e.providerId));
    return activeProviders.has(m.providerId);
  });

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            disabled={!prevDate}
            onClick={() => prevDate && onNavigate(prevDate)}
            title={prevDate ? `Go to ${fmtDate(prevDate)}` : "No previous day"}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <span className="text-sm font-semibold">{fmtDate(date)}</span>
            <span className="text-sm text-muted-foreground ml-2">${fmt(dayTotal)}</span>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            disabled={!nextDate}
            onClick={() => nextDate && onNavigate(nextDate)}
            title={nextDate ? `Go to ${fmtDate(nextDate)}` : "No next day"}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Provider share bar */}
      {dayTotal > 0 && (
        <div className="flex h-2 rounded-full overflow-hidden mb-4">
          {providerRows.map(e => (
            <div
              key={e.providerId}
              style={{
                width: `${(e.cost / dayTotal) * 100}%`,
                backgroundColor: colourMap[e.providerId],
              }}
              title={`${e.providerId}: $${fmt(e.cost)}`}
            />
          ))}
        </div>
      )}

      {/* Provider breakdown table */}
      {providerRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No cost data for this day.</p>
      ) : (
        <div className="space-y-1 mb-4">
          {providerRows.map(e => (
            <div key={e.providerId} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: colourMap[e.providerId] }}
                />
                <span className="text-muted-foreground">{e.providerId}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground text-xs">
                  {dayTotal > 0 ? `${((e.cost / dayTotal) * 100).toFixed(1)}%` : ""}
                </span>
                <span className="font-medium tabular-nums">${fmt(e.cost)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Model detail (filtered to active providers) */}
      {dayModels.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Models</p>
          <div className="space-y-1">
            {dayModels.map((m, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: colourMap[m.providerId] }}
                  />
                  <span className="text-muted-foreground">{m.modelId}</span>
                </div>
                <span className="tabular-nums">${fmt(m.cost)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
