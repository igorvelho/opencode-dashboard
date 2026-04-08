interface StatusDotProps {
  enabled: boolean;
  label?: string;
}

export function StatusDot({ enabled, label }: StatusDotProps) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`h-2 w-2 rounded-full ${enabled ? "bg-green-500" : "bg-gray-500"}`}
      />
      {label && (
        <span className="text-sm text-muted-foreground">{label}</span>
      )}
    </div>
  );
}
