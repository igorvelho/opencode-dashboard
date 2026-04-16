import { useState, useEffect } from "react";
import { PageLayout } from "@/components/layout/PageLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { useMetrics, useMetricsProjects } from "@/hooks/useMetrics";
import { RangeSelector } from "@/components/metrics/RangeSelector";
import { ProjectSelector } from "@/components/metrics/ProjectSelector";
import { StatCards } from "@/components/metrics/StatCards";
import { ProviderCards } from "@/components/metrics/ProviderCards";
import { DailyCostChart } from "@/components/metrics/DailyCostChart";
import { DayDetailPanel } from "@/components/metrics/DayDetailPanel";
import { DailyTokensChart } from "@/components/metrics/DailyTokensChart";
import { ModelBreakdownChart } from "@/components/metrics/ModelBreakdownChart";
import type { TimeRange } from "@shared/types";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function MetricsPage() {
  const [range, setRange] = useState<TimeRange>("current-month");
  const [pickerDate, setPickerDate] = useState<string>(todayStr());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);

  // Reset selected date when filters change
  useEffect(() => {
    setSelectedDate(null);
  }, [range, projectId]);

  // When range switches to "day", default pickerDate to today
  const handleRangeChange = (r: TimeRange) => {
    setRange(r);
    if (r === "day") setPickerDate(todayStr());
  };

  const apiDate = range === "day" ? pickerDate : undefined;

  const { projects } = useMetricsProjects();
  const { data, loading, error } = useMetrics(projectId, range, apiDate);

  return (
    <PageLayout
      title="Metrics"
      description="Token usage, cost, and session statistics from your OpenCode sessions."
    >
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <ProjectSelector projects={projects} value={projectId} onChange={setProjectId} />
        <RangeSelector
          value={range}
          date={pickerDate}
          onChange={handleRangeChange}
          onDateChange={setPickerDate}
        />
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive mb-4">
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
      )}

      {!loading && !error && data && (
        <div className="space-y-4">
          <StatCards data={data} />
          <ProviderCards providers={data.providers} totalCost={data.totalCost} />
          {range !== "day" && (
            <>
              <DailyCostChart
                dailyByProvider={data.dailyByProvider}
                providers={data.providers}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />
              {selectedDate && (
                <DayDetailPanel
                  date={selectedDate}
                  dailyByProvider={data.dailyByProvider}
                  models={data.models}
                  providers={data.providers}
                  onClose={() => setSelectedDate(null)}
                  onNavigate={setSelectedDate}
                />
              )}
              <DailyTokensChart data={data.daily} />
            </>
          )}
          <ModelBreakdownChart models={data.models} providers={data.providers} />
          {data.totalMessages === 0 && (
            <p className="text-sm text-muted-foreground mt-4">
              No data found for the selected project and time range.
            </p>
          )}
        </div>
      )}
    </PageLayout>
  );
}
