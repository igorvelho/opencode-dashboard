import type { TimeRange } from "@shared/types";

const RANGES: { value: TimeRange; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "current-month", label: "Current month" },
  { value: "all", label: "All time" },
];

interface Props {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

export function RangeSelector({ value, onChange }: Props) {
  return (
    <div className="flex gap-1">
      {RANGES.map((r) => (
        <button
          key={r.value}
          onClick={() => onChange(r.value)}
          className={
            "px-3 py-1.5 rounded-md text-sm font-medium transition-colors " +
            (value === r.value
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80")
          }
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
