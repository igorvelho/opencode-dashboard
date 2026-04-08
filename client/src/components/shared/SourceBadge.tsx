import { Badge } from "@/components/ui/badge";

const sourceStyles: Record<string, string> = {
  file: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  json: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  plugin: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  custom: "bg-green-500/10 text-green-500 border-green-500/20",
};

interface SourceBadgeProps {
  source: "file" | "json" | "plugin" | "custom";
}

export function SourceBadge({ source }: SourceBadgeProps) {
  return (
    <Badge variant="outline" className={sourceStyles[source]}>
      {source}
    </Badge>
  );
}
