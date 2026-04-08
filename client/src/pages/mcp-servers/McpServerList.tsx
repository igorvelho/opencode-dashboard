import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { PageLayout } from "@/components/layout/PageLayout";
import { useResource } from "@/hooks/useResource";
import { StatusDot } from "@/components/shared/StatusDot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
} from "@/components/ui/card";
import { api } from "@/lib/api";
import { Plus, Settings } from "lucide-react";

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

export function McpServerList() {
  const navigate = useNavigate();
  const { items, loading, error, refresh } = useResource<McpServer>("/mcp-servers");

  async function handleToggle(name: string) {
    try {
      await api.patch<McpServer>(`/mcp-servers/${encodeURIComponent(name)}/toggle`);
      toast.success(`Server "${name}" toggled`);
      await refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to toggle server");
    }
  }

  return (
    <PageLayout
      title="MCP Servers"
      description="Manage MCP server connections"
      actions={
        <Button onClick={() => navigate("/mcp-servers/new")}>
          <Plus className="mr-2 h-4 w-4" />
          New MCP Server
        </Button>
      }
    >
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No MCP servers configured. Add your first server to get started.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((server) => {
            const isLocal = server.config.type === "local";
            const enabled = server.config.enabled !== false;

            return (
              <Card key={server.name}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {server.name}
                    <Badge variant="outline" className="ml-1 text-xs">
                      {server.config.type}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="truncate">
                    {isLocal
                      ? (server.config as McpServerLocal).command.join(" ")
                      : (server.config as McpServerRemote).url}
                  </CardDescription>
                  <CardAction>
                    <Switch
                      checked={enabled}
                      onCheckedChange={() => handleToggle(server.name)}
                    />
                  </CardAction>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <StatusDot enabled={enabled} label={enabled ? "Enabled" : "Disabled"} />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      navigate(`/mcp-servers/${encodeURIComponent(server.name)}`)
                    }
                  >
                    <Settings className="mr-2 h-3 w-3" />
                    Configure
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </PageLayout>
  );
}
