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

interface AgentFrontmatter {
  description: string;
  mode?: "primary" | "subagent" | "all";
  model?: string;
  temperature?: number;
  steps?: number;
  color?: string;
  top_p?: number;
  hidden?: boolean;
  disable?: boolean;
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

const frontmatterFields: FieldConfig[] = [
  { key: "name", label: "Name", type: "text", required: true },
  { key: "description", label: "Description", type: "text", required: true },
  {
    key: "mode",
    label: "Mode",
    type: "select",
    options: ["primary", "subagent", "all"],
    placeholder: "Select mode...",
  },
  { key: "model", label: "Model", type: "text", placeholder: "e.g. claude-sonnet" },
  { key: "temperature", label: "Temperature", type: "number", min: 0, max: 1, step: 0.1 },
  { key: "steps", label: "Steps", type: "number", min: 1 },
  { key: "color", label: "Color", type: "text", placeholder: "e.g. #ff6600" },
  { key: "top_p", label: "Top P", type: "number", min: 0, max: 1, step: 0.1 },
  { key: "hidden", label: "Hidden", type: "boolean" },
  { key: "disable", label: "Disable", type: "boolean" },
];

export function AgentEdit() {
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
    mode: "",
    model: "",
    temperature: "",
    steps: "",
    color: "",
    top_p: "",
    hidden: false,
    disable: false,
  });
  const [body, setBody] = useState("");

  useEffect(() => {
    if (!isNew && name) {
      setLoading(true);
      api
        .get<Agent>(`/agents/${encodeURIComponent(name)}`)
        .then((agent) => {
          setFrontmatter({
            name: agent.name,
            description: agent.frontmatter.description ?? "",
            mode: agent.frontmatter.mode ?? "",
            model: agent.frontmatter.model ?? "",
            temperature: agent.frontmatter.temperature ?? "",
            steps: agent.frontmatter.steps ?? "",
            color: agent.frontmatter.color ?? "",
            top_p: agent.frontmatter.top_p ?? "",
            hidden: agent.frontmatter.hidden ?? false,
            disable: agent.frontmatter.disable ?? false,
          });
          setBody(agent.body);
          setSource(agent.source);
        })
        .catch((err: unknown) => {
          toast.error(err instanceof Error ? err.message : "Failed to load agent");
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
      const fm: Record<string, unknown> = {
        description: frontmatter.description as string,
      };
      if (frontmatter.mode) fm.mode = frontmatter.mode;
      if (frontmatter.model) fm.model = frontmatter.model;
      if (frontmatter.temperature !== "" && frontmatter.temperature !== undefined)
        fm.temperature = Number(frontmatter.temperature);
      if (frontmatter.steps !== "" && frontmatter.steps !== undefined)
        fm.steps = Number(frontmatter.steps);
      if (frontmatter.color) fm.color = frontmatter.color;
      if (frontmatter.top_p !== "" && frontmatter.top_p !== undefined)
        fm.top_p = Number(frontmatter.top_p);
      if (frontmatter.hidden) fm.hidden = true;
      if (frontmatter.disable) fm.disable = true;

      const payload = { frontmatter: fm, body };

      if (isNew) {
        await api.post("/agents", { name: frontmatter.name, ...payload });
        toast.success("Agent created");
      } else {
        await api.put(`/agents/${encodeURIComponent(name!)}`, payload);
        toast.success("Agent updated");
      }
      navigate("/agents");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save agent");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      await api.delete(`/agents/${encodeURIComponent(name!)}`);
      toast.success("Agent deleted");
      navigate("/agents");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete agent");
    }
  }

  if (loading) {
    return (
      <PageLayout title={isNew ? "New Agent" : "Edit Agent"}>
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
      title={isNew ? "New Agent" : `Edit Agent: ${name}`}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/agents")}>
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
          This agent is defined in JSON config and cannot be edited here.
        </div>
      )}

      <div className="space-y-6">
        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-medium mb-4">Configuration</h3>
          <FrontmatterForm
            fields={frontmatterFields}
            values={frontmatter}
            onChange={handleFrontmatterChange}
            readOnly={readOnly}
          />
        </div>

        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-medium mb-4">System Prompt</h3>
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
        title="Delete Agent"
        description={`Are you sure you want to delete "${name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        destructive
      />
    </PageLayout>
  );
}
