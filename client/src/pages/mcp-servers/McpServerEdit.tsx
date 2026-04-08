import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { PageLayout } from "@/components/layout/PageLayout";
import { KeyValueEditor } from "@/components/shared/KeyValueEditor";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { Save, Trash2, ArrowLeft, Plus, X } from "lucide-react";

interface McpServerLocal {
  type: "local";
  command: string[];
  environment?: Record<string, string>;
  enabled?: boolean;
  timeout?: number;
}

interface McpServerRemote {
  type: "remote";
  url: string;
  headers?: Record<string, string>;
  enabled?: boolean;
  timeout?: number;
}

type McpServerConfig = McpServerLocal | McpServerRemote;

interface McpServer {
  name: string;
  config: McpServerConfig;
  lastModified: string;
}

export function McpServerEdit() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const isNew = !name || name === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [serverName, setServerName] = useState("");
  const [type, setType] = useState<"local" | "remote">("local");
  const [enabled, setEnabled] = useState(true);
  const [timeout, setTimeout_] = useState<number | "">("");

  // Local fields
  const [command, setCommand] = useState<string[]>([""]);
  const [environment, setEnvironment] = useState<Record<string, string>>({});

  // Remote fields
  const [url, setUrl] = useState("");
  const [headers, setHeaders] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isNew && name) {
      setLoading(true);
      api
        .get<McpServer>(`/mcp-servers/${encodeURIComponent(name)}`)
        .then((server) => {
          setServerName(server.name);
          setType(server.config.type);
          setEnabled(server.config.enabled !== false);
          setTimeout_(server.config.timeout ?? "");

          if (server.config.type === "local") {
            setCommand(
              server.config.command.length > 0 ? server.config.command : [""],
            );
            setEnvironment(server.config.environment ?? {});
          } else {
            setUrl(server.config.url);
            setHeaders(server.config.headers ?? {});
          }
        })
        .catch((err: unknown) => {
          toast.error(err instanceof Error ? err.message : "Failed to load server");
        })
        .finally(() => setLoading(false));
    }
  }, [isNew, name]);

  function handleCommandChange(index: number, value: string) {
    setCommand((prev) => prev.map((c, i) => (i === index ? value : c)));
  }

  function addCommandPart() {
    setCommand((prev) => [...prev, ""]);
  }

  function removeCommandPart(index: number) {
    setCommand((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    const saveName = isNew ? serverName : name!;
    if (!saveName) {
      toast.error("Server name is required");
      return;
    }

    setSaving(true);
    try {
      let config: McpServerConfig;

      if (type === "local") {
        config = {
          type: "local",
          command: command.filter((c) => c.trim() !== ""),
          environment: Object.keys(environment).length > 0 ? environment : undefined,
          enabled,
          timeout: timeout !== "" ? Number(timeout) : undefined,
        };
      } else {
        config = {
          type: "remote",
          url,
          headers: Object.keys(headers).length > 0 ? headers : undefined,
          enabled,
          timeout: timeout !== "" ? Number(timeout) : undefined,
        };
      }

      if (isNew) {
        await api.post("/mcp-servers", { name: saveName, config });
        toast.success("MCP server created");
      } else {
        await api.put(`/mcp-servers/${encodeURIComponent(name!)}`, config);
        toast.success("MCP server updated");
      }
      navigate("/mcp-servers");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save server");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      await api.delete(`/mcp-servers/${encodeURIComponent(name!)}`);
      toast.success("MCP server deleted");
      navigate("/mcp-servers");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete server");
    }
  }

  if (loading) {
    return (
      <PageLayout title={isNew ? "New MCP Server" : "Edit MCP Server"}>
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
      title={isNew ? "New MCP Server" : `Edit MCP Server: ${name}`}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/mcp-servers")}>
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
      <div className="space-y-6 max-w-2xl">
        {/* Basic settings */}
        <div className="rounded-lg border p-4 space-y-4">
          <h3 className="text-sm font-medium">General</h3>

          {isNew && (
            <div className="space-y-2">
              <Label htmlFor="server-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="server-name"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                placeholder="my-server"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as "local" | "remote")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">Local</SelectItem>
                <SelectItem value="remote">Remote</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <Label htmlFor="enabled-toggle">Enabled</Label>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="timeout">Timeout (ms)</Label>
            <Input
              id="timeout"
              type="number"
              value={timeout}
              onChange={(e) =>
                setTimeout_(e.target.value ? Number(e.target.value) : "")
              }
              placeholder="30000"
            />
          </div>
        </div>

        {/* Type-specific settings */}
        {type === "local" ? (
          <>
            <div className="rounded-lg border p-4 space-y-4">
              <h3 className="text-sm font-medium">Command</h3>
              {command.map((part, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={part}
                    onChange={(e) => handleCommandChange(index, e.target.value)}
                    placeholder={index === 0 ? "executable" : "argument"}
                  />
                  {command.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeCommandPart(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addCommandPart} className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Add Argument
              </Button>
            </div>

            <div className="rounded-lg border p-4">
              <KeyValueEditor
                value={environment}
                onChange={setEnvironment}
                label="Environment Variables"
                keyPlaceholder="Variable name"
                valuePlaceholder="Value"
              />
            </div>
          </>
        ) : (
          <>
            <div className="rounded-lg border p-4 space-y-4">
              <h3 className="text-sm font-medium">Remote Connection</h3>
              <div className="space-y-2">
                <Label htmlFor="remote-url">
                  URL <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="remote-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/mcp"
                />
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <KeyValueEditor
                value={headers}
                onChange={setHeaders}
                label="Headers"
                keyPlaceholder="Header name"
                valuePlaceholder="Header value"
              />
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete MCP Server"
        description={`Are you sure you want to delete "${name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        destructive
      />
    </PageLayout>
  );
}
