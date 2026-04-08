import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { api } from "../lib/api";

interface Workspace {
  id: string;
  name: string;
  configPath: string;
  providerType: string;
  createdAt: string;
}

interface WorkspaceContextValue {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  setCurrentWorkspace: (ws: Workspace) => void;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspaces: [],
  currentWorkspace: null,
  setCurrentWorkspace: () => {},
  loading: true,
  error: null,
  refresh: async () => {},
});

export function useWorkspaceProvider(): WorkspaceContextValue {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspaceState] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const ws = await api.getWorkspaces();
      setWorkspaces(ws);
      if (ws.length > 0 && !currentWorkspace) {
        setCurrentWorkspaceState(ws[0]);
        api.setWorkspaceId(ws[0].id);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load workspaces";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace]);

  const setCurrentWorkspace = useCallback((ws: Workspace) => {
    setCurrentWorkspaceState(ws);
    api.setWorkspaceId(ws.id);
  }, []);

  useEffect(() => {
    refresh();
  }, []);

  return { workspaces, currentWorkspace, setCurrentWorkspace, loading, error, refresh };
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
