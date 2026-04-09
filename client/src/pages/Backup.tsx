import { useRef, useState } from "react";
import { toast } from "sonner";
import { PageLayout } from "@/components/layout/PageLayout";
import { useResource } from "@/hooks/useResource";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Archive, Download, RotateCcw, Upload } from "lucide-react";

type BackupSection = "skills" | "commands" | "agents" | "mcpServers" | "providers" | "config";

const ALL_SECTIONS: BackupSection[] = [
  "skills",
  "commands",
  "agents",
  "mcpServers",
  "providers",
  "config",
];

const SECTION_LABELS: Record<BackupSection, string> = {
  skills: "Skills",
  commands: "Commands",
  agents: "Agents",
  mcpServers: "MCP Servers",
  providers: "Providers & Models",
  config: "Config (opencode.json)",
};

interface BackupEntry {
  filename: string;
  timestamp: string;
  redacted: boolean;
  sections: BackupSection[];
  size: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function sectionSummary(sections: BackupSection[]): string {
  if (!sections || sections.length === ALL_SECTIONS.length) return "All";
  return sections.map((s) => SECTION_LABELS[s]).join(", ");
}

export function Backup() {
  const { items, loading, error, refresh } = useResource<BackupEntry>("/backup");
  const [redacted, setRedacted] = useState("false");
  const [selectedSections, setSelectedSections] = useState<Set<BackupSection>>(
    new Set(ALL_SECTIONS)
  );
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<BackupEntry | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function toggleSection(section: BackupSection) {
    setSelectedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }

  function toggleAll() {
    if (selectedSections.size === ALL_SECTIONS.length) {
      setSelectedSections(new Set());
    } else {
      setSelectedSections(new Set(ALL_SECTIONS));
    }
  }

  async function handleCreate() {
    if (selectedSections.size === 0) {
      toast.error("Select at least one section to export");
      return;
    }

    setCreating(true);
    try {
      const sections = Array.from(selectedSections).join(",");
      await api.post(`/backup?redact=${redacted}&sections=${sections}`);
      toast.success("Backup created successfully");
      await refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create backup");
    } finally {
      setCreating(false);
    }
  }

  function handleDownload(filename: string) {
    const url = api.getDownloadUrl(filename);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function handleImport(file: File) {
    setImporting(true);
    try {
      await api.uploadRestore(file);
      toast.success("Import successful — configuration has been updated");
      await refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to import backup");
    } finally {
      setImporting(false);
      // Reset file input so the same file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".zip")) {
      toast.error("Please select a .zip backup file");
      return;
    }
    handleImport(file);
  }

  async function handleRestore() {
    if (!restoreTarget) return;

    // Download the zip from server and re-upload as restore
    setImporting(true);
    setRestoreTarget(null);
    try {
      const url = api.getDownloadUrl(restoreTarget.filename);
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to download backup");
      const blob = await res.blob();
      const file = new File([blob], restoreTarget.filename, { type: "application/zip" });
      await api.uploadRestore(file);
      toast.success("Restore successful — configuration has been updated");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to restore backup");
    } finally {
      setImporting(false);
    }
  }

  const allSelected = selectedSections.size === ALL_SECTIONS.length;
  const someSelected = selectedSections.size > 0 && !allSelected;

  return (
    <PageLayout title="Backup & Restore" description="Export and import configuration sections">
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Export Section */}
        <div className="rounded-lg border p-4 space-y-4">
          <h3 className="text-sm font-medium">Export</h3>

          {/* Section checkboxes */}
          <div className="space-y-3">
            <Label>Sections to include</Label>
            <div className="flex items-center gap-2 pb-1 border-b border-border/50">
              <Checkbox
                id="select-all"
                checked={allSelected}
                indeterminate={someSelected && !allSelected}
                onCheckedChange={toggleAll}
              />
              <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                Select all
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {ALL_SECTIONS.map((section) => (
                <div key={section} className="flex items-center gap-2">
                  <Checkbox
                    id={`section-${section}`}
                    checked={selectedSections.has(section)}
                    onCheckedChange={() => toggleSection(section)}
                  />
                  <label
                    htmlFor={`section-${section}`}
                    className="text-sm cursor-pointer"
                  >
                    {SECTION_LABELS[section]}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Backup type + create button */}
          <div className="flex items-end gap-4">
            <div className="space-y-2">
              <Label>Secrets</Label>
              <Select value={redacted} onValueChange={(v) => { if (v) setRedacted(v); }}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">Include secrets</SelectItem>
                  <SelectItem value="true">Redact secrets</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCreate} disabled={creating || selectedSections.size === 0}>
              <Archive className="mr-2 h-4 w-4" />
              {creating
                ? "Creating..."
                : selectedSections.size === ALL_SECTIONS.length
                  ? "Export All"
                  : `Export ${selectedSections.size} section${selectedSections.size === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>

        {/* Import Section */}
        <div className="rounded-lg border p-4 space-y-4">
          <h3 className="text-sm font-medium">Import</h3>
          <p className="text-sm text-muted-foreground">
            Import a backup .zip file to apply its configuration to the current workspace.
            This will overwrite existing files for the sections included in the backup.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            <Upload className="mr-2 h-4 w-4" />
            {importing ? "Importing..." : "Choose .zip file to import"}
          </Button>
        </div>
      </div>

      {/* Backups List */}
      <div className="mt-8 rounded-lg border p-4">
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
            No backups found. Create your first export above.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Filename</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Sections</TableHead>
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
                  <TableCell className="text-sm max-w-48 truncate" title={sectionSummary(backup.sections)}>
                    {sectionSummary(backup.sections)}
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
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(backup.filename)}
                    >
                      <Download className="mr-1 h-3 w-3" />
                      Download
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRestoreTarget(backup)}
                    >
                      <RotateCcw className="mr-1 h-3 w-3" />
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
        description={`Are you sure you want to restore from "${restoreTarget?.filename}"? This will overwrite current configuration for the included sections: ${restoreTarget ? sectionSummary(restoreTarget.sections) : ""}.`}
        confirmLabel="Restore"
        onConfirm={handleRestore}
        destructive
      />
    </PageLayout>
  );
}
