import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { MetricsSummary, MetricsProject, TimeRange } from "@shared/types";

export function useMetricsProjects(): {
  projects: MetricsProject[];
  loading: boolean;
  error: string | null;
} {
  const [projects, setProjects] = useState<MetricsProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getMetricsProjects()
      .then((data) => {
        if (!cancelled) setProjects(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unknown error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { projects, loading, error };
}

export function useMetrics(
  projectId: string | null,
  range: TimeRange,
): {
  data: MetricsSummary | null;
  loading: boolean;
  error: string | null;
} {
  const [data, setData] = useState<MetricsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getMetrics(range, projectId)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unknown error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, range]);

  return { data, loading, error };
}
