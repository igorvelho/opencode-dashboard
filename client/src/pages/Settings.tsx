import { useState } from "react";
import { toast } from "sonner";
import { PageLayout } from "@/components/layout/PageLayout";
import { useWorkspace } from "@/hooks/useWorkspace";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";

export function Settings() {
  const { workspaces, currentWorkspace, setCurrentWorkspace, refresh } =
    useWorkspace();

  const [newName, setNewName] = useState("");
  const [newConfigPath, setNewConfigPath] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  async function handleAdd() {
    if (!newName || !newConfigPath) {
      toast.error("Name and config path are required");
      return;
    }

    setAdding(true);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, configPath: newConfigPath }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || res.statusText);
      }
      toast.success("Workspace added");
      setNewName("");
      setNewConfigPath("");
      await refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add workspace");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/workspaces/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || res.statusText);
      }
      toast.success("Workspace deleted");
      await refresh();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete workspace",
      );
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <PageLayout title="Settings" description="Manage workspaces and preferences">
      {/* Current Workspaces */}
      <div className="mb-8 rounded-lg border p-4">
        <h3 className="text-sm font-medium mb-4">Workspaces</h3>

        {workspaces.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No workspaces configured.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Config Path</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workspaces.map((ws) => (
                <TableRow key={ws.id}>
                  <TableCell className="font-medium">{ws.name}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {ws.configPath}
                  </TableCell>
                  <TableCell>
                    {currentWorkspace?.id === ws.id ? (
                      <span className="text-green-500 text-sm">Active</span>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCurrentWorkspace(ws);
                          toast.success(`Switched to ${ws.name}`);
                        }}
                      >
                        Switch
                      </Button>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() =>
                        setDeleteTarget({ id: ws.id, name: ws.name })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Add Workspace Form */}
      <div className="rounded-lg border p-4 space-y-4">
        <h3 className="text-sm font-medium">Add Workspace</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ws-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ws-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="My Project"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ws-path">
              Config Path <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ws-path"
              value={newConfigPath}
              onChange={(e) => setNewConfigPath(e.target.value)}
              placeholder="/path/to/project"
            />
          </div>
        </div>
        <Button onClick={handleAdd} disabled={adding}>
          <Plus className="mr-2 h-4 w-4" />
          {adding ? "Adding..." : "Add Workspace"}
        </Button>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Workspace"
        description={`Are you sure you want to delete workspace "${deleteTarget?.name}"? This will not delete any files.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        destructive
      />
    </PageLayout>
  );
}
