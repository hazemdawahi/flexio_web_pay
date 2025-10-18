// Small helper to try a single cookie-based refresh.
// Use this when you *don't* already have an access token, or after a 401.

const API_BASE =
  (typeof process !== "undefined" &&
    ((process as any).env?.REACT_APP_BASE_URL || (process as any).env?.BASE_URL)) ||
  "http://192.168.1.121:8080";

export type RefreshResponseData = {
  success: boolean;
  data?: { accessToken?: string; inapp?: boolean };
  error?: string;
};

export async function refreshOnce(opts?: { signal?: AbortSignal }): Promise<RefreshResponseData> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  const signal = opts?.signal ?? controller.signal;

  try {
    const res = await fetch(`${API_BASE}/api/user/refresh-tokens`, {
      method: "POST",
      credentials: "include",         // <-- send/receive HttpOnly cookie
      headers: { "Content-Type": "application/json" },
      signal,
      cache: "no-store",
    });

    let json: RefreshResponseData = { success: false };
    try {
      json = (await res.json()) as RefreshResponseData;
    } catch {
      // non-JSON or empty body; leave default
    }
    return json;
  } finally {
    clearTimeout(timeout);
  }
}
