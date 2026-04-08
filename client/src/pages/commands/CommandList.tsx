import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { useResource } from "@/hooks/useResource";
import { useWorkspace } from "@/hooks/useWorkspace";
import { SourceBadge } from "@/components/shared/SourceBadge";
import { CreateWithAIDialog } from "@/components/shared/CreateWithAIDialog";
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
import { Plus, Sparkles } from "lucide-react";

interface CommandFrontmatter {
  description: string;
  agent?: string;
  model?: string;
  subtask?: boolean;
}

interface Command {
  name: string;
  frontmatter: CommandFrontmatter;
  body: string;
  source: "file" | "json";
  filePath?: string;
  lastModified: string;
}

export function CommandList() {
  const navigate = useNavigate();
  const { items, loading, error } = useResource<Command>("/commands");
  const { currentWorkspace } = useWorkspace();
  const [aiDialogOpen, setAiDialogOpen] = useState(false);

  return (
    <PageLayout
      title="Commands"
      titleTooltip="Reusable prompt templates invoked with a slash (e.g. /review)"
      description="Manage slash command definitions"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setAiDialogOpen(true)}>
            <Sparkles className="mr-2 h-4 w-4" />
            Create with AI
          </Button>
          <Button onClick={() => navigate("/commands/new")}>
            <Plus className="mr-2 h-4 w-4" />
            New Command
          </Button>
        </div>
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
          No commands found. Create your first command to get started.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((cmd) => (
              <TableRow
                key={cmd.name}
                className="cursor-pointer"
                onClick={() => navigate(`/commands/${encodeURIComponent(cmd.name)}`)}
              >
                <TableCell className="font-medium">{cmd.name}</TableCell>
                <TableCell className="text-muted-foreground max-w-md truncate">
                  {cmd.frontmatter.description}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {cmd.frontmatter.agent ?? "—"}
                </TableCell>
                <TableCell>
                  <SourceBadge source={cmd.source} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <CreateWithAIDialog
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
        entityType="command"
        existingNames={items.map((c) => c.name)}
        configPath={currentWorkspace?.configPath ?? "~/.config/opencode"}
      />
    </PageLayout>
  );
}
