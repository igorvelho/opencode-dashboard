import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { useResource } from "@/hooks/useResource";
import { SourceBadge } from "@/components/shared/SourceBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus } from "lucide-react";

interface AgentFrontmatter {
  description: string;
  mode?: "primary" | "subagent" | "all";
  model?: string;
  [key: string]: unknown;
}

interface Agent {
  name: string;
  frontmatter: AgentFrontmatter;
  body: string;
  source: "file" | "json";
  filePath?: string;
  lastModified: string;
}

const modeStyles: Record<string, string> = {
  primary: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  subagent: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  all: "bg-green-500/10 text-green-500 border-green-500/20",
};

export function AgentList() {
  const navigate = useNavigate();
  const { items, loading, error } = useResource<Agent>("/agents");

  return (
    <PageLayout
      title="Agents"
      description="Manage agent configurations"
      actions={
        <Button onClick={() => navigate("/agents/new")}>
          <Plus className="mr-2 h-4 w-4" />
          New Agent
        </Button>
      }
    >
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No agents found. Create your first agent to get started.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((agent) => (
              <TableRow
                key={agent.name}
                className="cursor-pointer"
                onClick={() => navigate(`/agents/${encodeURIComponent(agent.name)}`)}
              >
                <TableCell className="font-medium">{agent.name}</TableCell>
                <TableCell className="text-muted-foreground max-w-md truncate">
                  {agent.frontmatter.description}
                </TableCell>
                <TableCell>
                  {agent.frontmatter.mode ? (
                    <Badge
                      variant="outline"
                      className={modeStyles[agent.frontmatter.mode] ?? ""}
                    >
                      {agent.frontmatter.mode}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {agent.frontmatter.model ?? "—"}
                </TableCell>
                <TableCell>
                  <SourceBadge source={agent.source} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </PageLayout>
  );
}
