import type { TimeRange } from "@shared/types";

const PRESET_RANGES: { value: TimeRange; label: string }[] = [
  { value: "30d", label: "Last 30 days" },
  { value: "current-month", label: "Current month" },
  { value: "all", label: "All time" },
];

interface Props {
  value: TimeRange;
  date: string; // YYYY-MM-DD, used when value === "day"
  onChange: (range: TimeRange) => void;
  onDateChange: (date: string) => void;
}

export function RangeSelector({ value, date, onChange, onDateChange }: Props) {
  return (
    <div className="flex flex-wrap gap-1 items-center">
      {PRESET_RANGES.map((r) => (
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
      <button
        onClick={() => onChange("day")}
        className={
          "px-3 py-1.5 rounded-md text-sm font-medium transition-colors " +
          (value === "day"
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:bg-muted/80")
        }
      >
        Day
      </button>
      {value === "day" && (
        <input
          type="date"
          value={date}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => onDateChange(e.target.value)}
          className="px-2 py-1 rounded-md text-sm border bg-background text-foreground border-input focus:outline-none focus:ring-1 focus:ring-ring"
        />
      )}
    </div>
  );
}
