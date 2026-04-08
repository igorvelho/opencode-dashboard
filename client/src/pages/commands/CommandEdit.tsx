import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { PageLayout } from "@/components/layout/PageLayout";
import { FrontmatterForm, type FieldConfig } from "@/components/editors/FrontmatterForm";
import { MarkdownEditor } from "@/components/editors/MarkdownEditor";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { Save, Trash2, ArrowLeft } from "lucide-react";

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

const frontmatterFields: FieldConfig[] = [
  { key: "name", label: "Name", type: "text", required: true },
  { key: "description", label: "Description", type: "text", required: true },
  { key: "agent", label: "Agent", type: "text", placeholder: "e.g. coder" },
  { key: "model", label: "Model", type: "text", placeholder: "e.g. claude-sonnet" },
  { key: "subtask", label: "Subtask", type: "boolean" },
];

export function CommandEdit() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const isNew = !name || name === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [source, setSource] = useState<"file" | "json">("file");

  const [frontmatter, setFrontmatter] = useState<Record<string, unknown>>({
    name: "",
    description: "",
    agent: "",
    model: "",
    subtask: false,
  });
  const [body, setBody] = useState("");

  useEffect(() => {
    if (!isNew && name) {
      setLoading(true);
      api
        .get<Command>(`/commands/${encodeURIComponent(name)}`)
        .then((cmd) => {
          setFrontmatter({
            name: cmd.name,
            description: cmd.frontmatter.description ?? "",
            agent: cmd.frontmatter.agent ?? "",
            model: cmd.frontmatter.model ?? "",
            subtask: cmd.frontmatter.subtask ?? false,
          });
          setBody(cmd.body);
          setSource(cmd.source);
        })
        .catch((err: unknown) => {
          toast.error(err instanceof Error ? err.message : "Failed to load command");
        })
        .finally(() => setLoading(false));
    }
  }, [isNew, name]);

  const readOnly = source === "json";

  function handleFrontmatterChange(key: string, value: unknown) {
    if (key === "name" && !isNew) return;
    setFrontmatter((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!frontmatter.description) {
      toast.error("Description is required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        frontmatter: {
          description: frontmatter.description as string,
          agent: (frontmatter.agent as string) || undefined,
          model: (frontmatter.model as string) || undefined,
          subtask: frontmatter.subtask ? true : undefined,
        },
        body,
      };

      if (isNew) {
        await api.post("/commands", { name: frontmatter.name, ...payload });
        toast.success("Command created");
      } else {
        await api.put(`/commands/${encodeURIComponent(name!)}`, payload);
        toast.success("Command updated");
      }
      navigate("/commands");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save command");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      await api.delete(`/commands/${encodeURIComponent(name!)}`);
      toast.success("Command deleted");
      navigate("/commands");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete command");
    }
  }

  if (loading) {
    return (
      <PageLayout title={isNew ? "New Command" : "Edit Command"}>
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={isNew ? "New Command" : `Edit Command: ${name}`}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/commands")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          {!isNew && !readOnly && (
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
          {!readOnly && (
            <Button onClick={handleSave} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save"}
            </Button>
          )}
        </div>
      }
    >
      {readOnly && (
        <div className="mb-4 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-amber-500 text-sm">
          This command is defined in JSON config and cannot be edited here.
        </div>
      )}

      <div className="space-y-6">
        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-medium mb-4">Properties</h3>
          <FrontmatterForm
            fields={frontmatterFields}
            values={frontmatter}
            onChange={handleFrontmatterChange}
            readOnly={readOnly}
          />
        </div>

        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-medium mb-4">Prompt Template</h3>
          {readOnly ? (
            <pre className="whitespace-pre-wrap text-sm text-muted-foreground">{body}</pre>
          ) : (
            <MarkdownEditor value={body} onChange={setBody} />
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Command"
        description={`Are you sure you want to delete "${name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        destructive
      />
    </PageLayout>
  );
}
