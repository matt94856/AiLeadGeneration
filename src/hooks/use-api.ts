"use client";

import { useCallback, useState } from "react";

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useApi<T>() {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const request = useCallback(async (url: string, options?: RequestInit): Promise<T | null> => {
    setState({ data: null, loading: true, error: null });
    try {
      const res = await fetch(url, {
        ...options,
        headers: { "Content-Type": "application/json", ...options?.headers },
      });
      const json = (await res.json()) as { success: boolean; data?: T; error?: { message: string } };
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message ?? "Request failed");
      }
      setState({ data: json.data ?? null, loading: false, error: null });
      return json.data ?? null;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setState({ data: null, loading: false, error: message });
      return null;
    }
  }, []);

  return { ...state, request };
}
