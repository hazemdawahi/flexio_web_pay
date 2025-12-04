const API_BASE =
  (typeof process !== "undefined" &&
    ((process as any).env?.REACT_APP_BASE_URL || (process as any).env?.BASE_URL)) ||
  "http://localhost:8080";

export type RefreshResponseData = {
  success: boolean;
  data?: { accessToken?: string; inapp?: boolean };
  error?: string;
};

let refreshPromise: Promise<RefreshResponseData> | null = null;

export async function refreshOnce(opts?: { signal?: AbortSignal }): Promise<RefreshResponseData> {
  if (refreshPromise) {
    return refreshPromise;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  const signal = opts?.signal ?? controller.signal;

  refreshPromise = (async (): Promise<RefreshResponseData> => {
    try {
      const res = await fetch(`${API_BASE}/api/user/refresh-tokens`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        signal,
        cache: "no-store",
      });

      let json: RefreshResponseData = { success: false };
      try {
        json = (await res.json()) as RefreshResponseData;
      } catch {
        // non-JSON or empty body
      }

      if (json.success && json.data?.accessToken) {
        try {
          sessionStorage.setItem("accessToken", json.data.accessToken);
        } catch {}
      }

      return json;
    } catch (err: any) {
      if (err.name === "AbortError") {
        return { success: false, error: "Request timed out" };
      }
      return { success: false, error: err?.message || "Refresh failed" };
    } finally {
      clearTimeout(timeout);
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}