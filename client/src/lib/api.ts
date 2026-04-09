const BASE_URL = "/api";

class ApiClient {
  private workspaceId: string | null = null;

  setWorkspaceId(id: string) {
    this.workspaceId = id;
  }

  getWorkspaceId(): string | null {
    return this.workspaceId;
  }

  private getWorkspaceUrl(path: string): string {
    if (!this.workspaceId) throw new Error("No workspace selected");
    return `${BASE_URL}/workspaces/${this.workspaceId}${path}`;
  }

  async get<T>(path: string): Promise<T> {
    const res = await fetch(this.getWorkspaceUrl(path));
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error?.message || res.statusText);
    }
    return res.json();
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(this.getWorkspaceUrl(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error?.message || res.statusText);
    }
    if (res.status === 204) return undefined as T;
    return res.json();
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(this.getWorkspaceUrl(path), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error?.message || res.statusText);
    }
    return res.json();
  }

  async patch<T>(path: string): Promise<T> {
    const res = await fetch(this.getWorkspaceUrl(path), { method: "PATCH" });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error?.message || res.statusText);
    }
    return res.json();
  }

  async delete(path: string): Promise<void> {
    const res = await fetch(this.getWorkspaceUrl(path), { method: "DELETE" });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error?.message || res.statusText);
    }
  }

  /** Get a full download URL for a backup file */
  getDownloadUrl(filename: string): string {
    return this.getWorkspaceUrl(`/backup/download/${encodeURIComponent(filename)}`);
  }

  /** Upload a zip file to restore/import */
  async uploadRestore(file: File): Promise<{ success: boolean }> {
    const res = await fetch(this.getWorkspaceUrl("/backup/restore"), {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: file,
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error?.message || res.statusText);
    }
    return res.json();
  }

  async getWorkspaces() {
    const res = await fetch(`${BASE_URL}/workspaces`);
    return res.json();
  }

  async getMetricsProjects(): Promise<import("@shared/types").MetricsProject[]> {
    const res = await fetch(`${BASE_URL}/metrics/projects`);
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error?.message || res.statusText);
    }
    return res.json();
  }

  async getMetrics(
    range: import("@shared/types").TimeRange,
    projectId: string | null,
  ): Promise<import("@shared/types").MetricsSummary> {
    const params = new URLSearchParams({ range });
    if (projectId) params.set("projectId", projectId);
    const res = await fetch(`${BASE_URL}/metrics?${params}`);
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error?.message || res.statusText);
    }
    return res.json();
  }

  async getVersionInfo(): Promise<{
    current: string;
    latest: string | null;
    updateAvailable: boolean;
  }> {
    const res = await fetch(`${BASE_URL}/version`);
    if (!res.ok) throw new Error("Failed to check version");
    return res.json();
  }

  async triggerUpdate(): Promise<{
    success: boolean;
    message: string;
    updatedVersion?: string;
  }> {
    const res = await fetch(`${BASE_URL}/version/update`, { method: "POST" });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || res.statusText);
    }
    return res.json();
  }
}

export const api = new ApiClient();
