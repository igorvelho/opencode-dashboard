import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { ArrowDownToLine, X, RefreshCw, Loader2 } from "lucide-react";

export function UpdateBanner() {
  const [versionInfo, setVersionInfo] = useState<{
    current: string;
    latest: string | null;
    updateAvailable: boolean;
  } | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateResult, setUpdateResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    const wasDismissed = sessionStorage.getItem("update-banner-dismissed");
    if (wasDismissed) {
      setDismissed(true);
      return;
    }

    api.getVersionInfo().then(setVersionInfo).catch(() => {
      // silently ignore — version check is best-effort
    });
  }, []);

  if (dismissed || !versionInfo?.updateAvailable) return null;

  async function handleUpdate() {
    setUpdating(true);
    try {
      const result = await api.triggerUpdate();
      setUpdateResult(result);
      if (result.success) {
        // Reload the page to pick up the new client files
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (err: unknown) {
      setUpdateResult({
        success: false,
        message: err instanceof Error ? err.message : "Update failed",
      });
    } finally {
      setUpdating(false);
    }
  }

  function handleDismiss() {
    sessionStorage.setItem("update-banner-dismissed", "1");
    setDismissed(true);
  }

  return (
    <div className="flex items-center gap-3 bg-primary/10 border-b border-primary/20 px-4 py-2 text-sm">
      <ArrowDownToLine className="h-4 w-4 shrink-0 text-primary" />
      {updateResult ? (
        <span className={updateResult.success ? "text-green-600 dark:text-green-400" : "text-destructive"}>
          {updateResult.message}
          {updateResult.success && (
            <span className="ml-2 inline-flex items-center gap-1 text-muted-foreground">
              <RefreshCw className="h-3 w-3 animate-spin" /> Reloading...
            </span>
          )}
        </span>
      ) : (
        <>
          <span className="text-foreground">
            Update available:{" "}
            <span className="font-medium">v{versionInfo.current}</span>
            {" → "}
            <span className="font-medium">v{versionInfo.latest}</span>
          </span>
          <button
            onClick={handleUpdate}
            disabled={updating}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {updating ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <ArrowDownToLine className="h-3 w-3" />
                Update now
              </>
            )}
          </button>
        </>
      )}
      {!updateResult && (
        <button
          onClick={handleDismiss}
          className="ml-2 rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
          title="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
