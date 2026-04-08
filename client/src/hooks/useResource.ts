import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";

export function useResource<T>(basePath: string) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<T[]>(basePath);
      setItems(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [basePath]);

  const get = useCallback(
    async (id: string): Promise<T> => {
      return api.get<T>(`${basePath}/${id}`);
    },
    [basePath],
  );

  const create = useCallback(
    async (data: unknown): Promise<T> => {
      const result = await api.post<T>(basePath, data);
      await refresh();
      return result;
    },
    [basePath, refresh],
  );

  const update = useCallback(
    async (id: string, data: unknown): Promise<T> => {
      const result = await api.put<T>(`${basePath}/${id}`, data);
      await refresh();
      return result;
    },
    [basePath, refresh],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      await api.delete(`${basePath}/${id}`);
      await refresh();
    },
    [basePath, refresh],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { items, loading, error, get, create, update, remove, refresh };
}
