import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { PageLayout } from "@/components/layout/PageLayout";
import { FrontmatterForm, type FieldConfig } from "@/components/editors/FrontmatterForm";
import { MarkdownEditor } from "@/components/editors/MarkdownEditor";
import { KeyValueEditor } from "@/components/shared/KeyValueEditor";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { Save, Trash2, ArrowLeft } from "lucide-react";

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

const frontmatterFields: FieldConfig[] = [
  { key: "name", label: "Name", type: "text", required: true },
  { key: "description", label: "Description", type: "text", required: true },
  { key: "license", label: "License", type: "text" },
  { key: "compatibility", label: "Compatibility", type: "text" },
];

export function SkillEdit() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const isNew = !name || name === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [source, setSource] = useState<"custom" | "plugin">("custom");

  const [frontmatter, setFrontmatter] = useState<Record<string, unknown>>({
    name: "",
    description: "",
    license: "",
    compatibility: "",
  });
  const [metadata, setMetadata] = useState<Record<string, string>>({});
  const [body, setBody] = useState("");

  useEffect(() => {
    if (!isNew && name) {
      setLoading(true);
      api
        .get<Skill>(`/skills/${encodeURIComponent(name)}`)
        .then((skill) => {
          setFrontmatter({
            name: skill.frontmatter.name ?? skill.name,
            description: skill.frontmatter.description ?? "",
            license: skill.frontmatter.license ?? "",
            compatibility: skill.frontmatter.compatibility ?? "",
          });
          setMetadata(skill.frontmatter.metadata ?? {});
          setBody(skill.body);
          setSource(skill.source);
        })
        .catch((err: unknown) => {
          toast.error(err instanceof Error ? err.message : "Failed to load skill");
        })
        .finally(() => setLoading(false));
    }
  }, [isNew, name]);

  const readOnly = source === "plugin";

  const fields = frontmatterFields.map((f) =>
    f.key === "name" && !isNew ? { ...f, description: "Cannot change skill name" } : f,
  );

  function handleFrontmatterChange(key: string, value: unknown) {
    if (key === "name" && !isNew) return;
    setFrontmatter((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!frontmatter.name || !frontmatter.description) {
      toast.error("Name and description are required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        frontmatter: {
          name: frontmatter.name as string,
          description: frontmatter.description as string,
          license: (frontmatter.license as string) || undefined,
          compatibility: (frontmatter.compatibility as string) || undefined,
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        },
        body,
      };

      if (isNew) {
        await api.post("/skills", { name: frontmatter.name, ...payload });
        toast.success("Skill created");
      } else {
        await api.put(`/skills/${encodeURIComponent(name!)}`, payload);
        toast.success("Skill updated");
      }
      navigate("/skills");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save skill");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      await api.delete(`/skills/${encodeURIComponent(name!)}`);
      toast.success("Skill deleted");
      navigate("/skills");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete skill");
    }
  }

  if (loading) {
    return (
      <PageLayout title={isNew ? "New Skill" : "Edit Skill"}>
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
      title={isNew ? "New Skill" : `Edit Skill: ${name}`}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/skills")}>
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
          This skill is from a plugin and cannot be edited.
        </div>
      )}

      <div className="space-y-6">
        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-medium mb-4">Frontmatter</h3>
          <FrontmatterForm
            fields={fields}
            values={frontmatter}
            onChange={handleFrontmatterChange}
            readOnly={readOnly || (!isNew && frontmatter.name !== undefined ? false : false)}
          />
        </div>

        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-medium mb-4">Metadata</h3>
          <KeyValueEditor
            value={metadata}
            onChange={(v) => !readOnly && setMetadata(v)}
          />
        </div>

        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-medium mb-4">Body Content</h3>
          {readOnly ? (
            <div className="prose prose-invert max-w-none">
              <pre className="whitespace-pre-wrap text-sm text-muted-foreground">{body}</pre>
            </div>
          ) : (
            <MarkdownEditor value={body} onChange={setBody} />
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Skill"
        description={`Are you sure you want to delete "${name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        destructive
      />
    </PageLayout>
  );
}
