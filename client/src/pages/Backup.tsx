import { useState } from "react";
import { toast } from "sonner";
import { PageLayout } from "@/components/layout/PageLayout";
import { useResource } from "@/hooks/useResource";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { Archive, RotateCcw } from "lucide-react";

interface BackupEntry {
  filename: string;
  timestamp: string;
  redacted: boolean;
  size: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function Backup() {
  const { items, loading, error, refresh } = useResource<BackupEntry>("/backup");
  const [redacted, setRedacted] = useState("false");
  const [creating, setCreating] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<BackupEntry | null>(null);

  async function handleCreate() {
    setCreating(true);
    try {
      await api.post(`/backup?redact=${redacted}`);
      toast.success("Backup created successfully");
      await refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create backup");
    } finally {
      setCreating(false);
    }
  }

  async function handleRestore() {
    if (!restoreTarget) return;

    toast.info("Restore functionality requires uploading the backup file. Use the CLI for now.");
    setRestoreTarget(null);
  }

  return (
    <PageLayout title="Backup & Restore" description="Create and manage configuration backups">
      {/* Create Backup Section */}
      <div className="mb-8 rounded-lg border p-4 space-y-4">
        <h3 className="text-sm font-medium">Create Backup</h3>
        <div className="flex items-end gap-4">
          <div className="space-y-2">
            <Label>Backup Type</Label>
            <Select value={redacted} onValueChange={(v) => { if (v) setRedacted(v); }}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="false">Full Backup</SelectItem>
                <SelectItem value="true">Redacted (no secrets)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleCreate} disabled={creating}>
            <Archive className="mr-2 h-4 w-4" />
            {creating ? "Creating..." : "Create Backup"}
          </Button>
        </div>
      </div>

      {/* Backups List */}
      <div className="rounded-lg border p-4">
        <h3 className="text-sm font-medium mb-4">Previous Backups</h3>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
            {error}
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No backups found. Create your first backup above.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Filename</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((backup) => (
                <TableRow key={backup.filename}>
                  <TableCell className="font-mono text-sm">
                    {backup.filename}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(backup.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {backup.redacted ? (
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                        redacted
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                        full
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatBytes(backup.size)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRestoreTarget(backup)}
                    >
                      <RotateCcw className="mr-2 h-3 w-3" />
                      Restore
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <ConfirmDialog
        open={restoreTarget !== null}
        onOpenChange={(open) => !open && setRestoreTarget(null)}
        title="Restore Backup"
        description={`Are you sure you want to restore from "${restoreTarget?.filename}"? This will overwrite current configuration.`}
        confirmLabel="Restore"
        onConfirm={handleRestore}
        destructive
      />
    </PageLayout>
  );
}
