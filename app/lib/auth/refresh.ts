// ~/lib/auth/refresh.ts
import { API_BASE } from "./apiClient";

export type RefreshResponseData = {
  success: boolean;
  data?: {
    accessToken?: string;
    // Backend may send these as either booleans or strings ("true"/"false").
    inapp?: boolean | string;
    inApp?: boolean | string;
    inappuse?: boolean | string;
  };
  error?: string;
};

let refreshPromise: Promise<RefreshResponseData> | null = null;

export async function refresh(
  opts?: { signal?: AbortSignal }
): Promise<RefreshResponseData> {
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
        // non-JSON or empty body is fine; we'll fall back to defaults
      }

      // 401 or 403 means no valid refresh token (web-only login or expired/invalid cookie)
      if (res.status === 401 || res.status === 403) {
        // IMPORTANT: do NOT touch sessionStorage here.
        // Caller (SessionProvider) decides whether to clear or keep tokens.
        return {
          success: false,
          error: json.error || "No valid session",
        };
      }

      // For success or other statuses, just return JSON as-is.
      // Do NOT write anything to storage here; SessionProvider owns that.
      return json;
    } catch (err: any) {
      if (err?.name === "AbortError") {
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