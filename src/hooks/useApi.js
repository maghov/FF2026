import { useState, useEffect, useCallback } from "react";

export function useApi(fetchFn, deps = [], autoRefreshMs = null) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchFn();
      setData(result);
    } catch (err) {
      setError(err.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchFn, ...deps]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!autoRefreshMs) return;
    const interval = setInterval(load, autoRefreshMs);
    return () => clearInterval(interval);
  }, [load, autoRefreshMs]);

  return { data, loading, error, reload: load };
}
