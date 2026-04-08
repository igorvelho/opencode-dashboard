import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { PageLayout } from "@/components/layout/PageLayout";
import { CodeEditor } from "@/components/editors/CodeEditor";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { Save, Trash2, ArrowLeft } from "lucide-react";

interface ProviderConfig {
  options?: Record<string, unknown>;
  models?: Record<string, unknown>;
  [key: string]: unknown;
}

interface Provider {
  name: string;
  config: ProviderConfig;
  lastModified: string;
}

export function ProviderEdit() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const isNew = !name || name === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [providerName, setProviderName] = useState("");
  const [configJson, setConfigJson] = useState("{\n  \n}");

  useEffect(() => {
    if (!isNew && name) {
      setLoading(true);
      api
        .get<Provider>(`/providers/${encodeURIComponent(name)}`)
        .then((provider) => {
          setProviderName(provider.name);
          setConfigJson(JSON.stringify(provider.config, null, 2));
        })
        .catch((err: unknown) => {
          toast.error(err instanceof Error ? err.message : "Failed to load provider");
        })
        .finally(() => setLoading(false));
    }
  }, [isNew, name]);

  async function handleSave() {
    const saveName = isNew ? providerName : name!;
    if (!saveName) {
      toast.error("Provider name is required");
      return;
    }

    let parsed: ProviderConfig;
    try {
      parsed = JSON.parse(configJson);
    } catch {
      toast.error("Invalid JSON configuration");
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        await api.post("/providers", { name: saveName, config: parsed });
        toast.success("Provider created");
      } else {
        await api.put(`/providers/${encodeURIComponent(name!)}`, parsed);
        toast.success("Provider updated");
      }
      navigate("/providers");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save provider");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      await api.delete(`/providers/${encodeURIComponent(name!)}`);
      toast.success("Provider deleted");
      navigate("/providers");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete provider");
    }
  }

  if (loading) {
    return (
      <PageLayout title={isNew ? "New Provider" : "Edit Provider"}>
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={isNew ? "New Provider" : `Edit Provider: ${name}`}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/providers")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          {!isNew && (
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {isNew && (
          <div className="rounded-lg border p-4 space-y-2">
            <Label htmlFor="provider-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="provider-name"
              value={providerName}
              onChange={(e) => setProviderName(e.target.value)}
              placeholder="e.g. openai, anthropic"
            />
          </div>
        )}

        <div className="rounded-lg border p-4 space-y-3">
          <Label>Provider Configuration (JSON)</Label>
          <p className="text-xs text-muted-foreground">
            Define options, models, and variants in JSON format.
          </p>
          <CodeEditor
            value={configJson}
            onChange={setConfigJson}
            height="500px"
          />
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Provider"
        description={`Are you sure you want to delete "${name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        destructive
      />
    </PageLayout>
  );
}
