import { useState, useEffect } from "react";
import { toast } from "sonner";
import { PageLayout } from "@/components/layout/PageLayout";
import { CodeEditor } from "@/components/editors/CodeEditor";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { Save } from "lucide-react";

export function ConfigEditor() {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .get<{ content: string }>("/config")
      .then((data) => {
        setContent(data.content);
      })
      .catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : "Failed to load config");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await api.put("/config", { content });
      toast.success("Configuration saved");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save config");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageLayout
      title="Config Editor"
      description="Edit the raw opencode.json configuration"
      actions={
        <Button onClick={handleSave} disabled={saving || loading}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save"}
        </Button>
      }
    >
      {loading ? (
        <Skeleton className="h-[600px] w-full" />
      ) : (
        <CodeEditor
          value={content}
          onChange={setContent}
          height="calc(100vh - 200px)"
        />
      )}
    </PageLayout>
  );
}
