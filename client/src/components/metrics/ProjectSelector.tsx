import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MetricsProject } from "@shared/types";

interface Props {
  projects: MetricsProject[];
  value: string | null;
  onChange: (id: string | null) => void;
}

export function ProjectSelector({ projects, value, onChange }: Props) {
  return (
    <Select
      value={value ?? "global"}
      onValueChange={(v) => onChange(v === "global" ? null : v)}
    >
      <SelectTrigger className="w-64">
        <SelectValue placeholder="Select project" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="global">Global (all projects)</SelectItem>
        {projects.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
