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

interface SkillFrontmatter {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
}

interface Skill {
  name: string;
  frontmatter: SkillFrontmatter;
  body: string;
  source: "custom" | "plugin";
  filePath: string;
  lastModified: string;
}

export function SkillList() {
  const navigate = useNavigate();
  const { items, loading, error } = useResource<Skill>("/skills");
  const { currentWorkspace } = useWorkspace();
  const [aiDialogOpen, setAiDialogOpen] = useState(false);

  return (
    <PageLayout
      title="Skills"
      titleTooltip="Specialized instruction sets that guide AI behavior for specific tasks"
      description="Manage skill definitions"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setAiDialogOpen(true)}>
            <Sparkles className="mr-2 h-4 w-4" />
            Create with AI
          </Button>
          <Button onClick={() => navigate("/skills/new")}>
            <Plus className="mr-2 h-4 w-4" />
            New Skill
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
          No skills found. Create your first skill to get started.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Last Modified</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((skill) => (
              <TableRow
                key={skill.name}
                className="cursor-pointer"
                onClick={() => navigate(`/skills/${encodeURIComponent(skill.name)}`)}
              >
                <TableCell className="font-medium">{skill.name}</TableCell>
                <TableCell className="text-muted-foreground max-w-md truncate">
                  {skill.frontmatter.description}
                </TableCell>
                <TableCell>
                  <SourceBadge source={skill.source} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(skill.lastModified).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <CreateWithAIDialog
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
        entityType="skill"
        existingNames={items.map((s) => s.name)}
        configPath={currentWorkspace?.configPath ?? "~/.config/opencode"}
      />
    </PageLayout>
  );
}
