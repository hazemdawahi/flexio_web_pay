// src/hooks/useRefreshSession.ts
import { useMutation } from "@tanstack/react-query";

const API_BASE =
  (typeof process !== "undefined" &&
    ((process as any).env?.REACT_APP_BASE_URL || (process as any).env?.BASE_URL)) ||
  "http://192.168.1.121:8080";

type RefreshResponse = {
  success: boolean;
  data?: { accessToken?: string; inapp?: boolean };
  error?: string;
};

export function useRefreshSession() {
  return useMutation<RefreshResponse, Error, void>({
    mutationFn: async () => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 7000);

      try {
        const res = await fetch(`${API_BASE}/api/user/refresh-tokens`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
        });

        // Try to parse JSON, but don't let a parse error hang things
        let json: RefreshResponse = { success: false };
        try {
          json = (await res.json()) as RefreshResponse;
        } catch {
          // ignore parse errors; treat like failure
        }

        if (!res.ok) {
          // Surface a standard Error so mutateAsync rejects and our provider catches
          throw new Error(json?.error || `Refresh failed: ${res.status}`);
        }
        return json;
      } finally {
        clearTimeout(id);
      }
    },
  });
}
