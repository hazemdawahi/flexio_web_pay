// ~/lib/api/apiClient.ts

const API_BASE =
  (typeof process !== "undefined" &&
    ((process as any).env?.REACT_APP_BASE_URL || (process as any).env?.BASE_URL)) ||
  "http://localhost:8080";

const isBrowser = typeof window !== "undefined";

function getAccessToken(): string | null {
  if (!isBrowser) return null;
  try {
    return sessionStorage.getItem("accessToken");
  } catch {
    return null;
  }
}

function clearAccessToken(): void {
  if (!isBrowser) return;
  try {
    sessionStorage.removeItem("accessToken");
  } catch {}
}

function dispatchAuthError(): void {
  if (!isBrowser) return;
  window.dispatchEvent(new CustomEvent("auth:error"));
}

export async function authFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAccessToken();

  if (!token) {
    clearAccessToken();
    dispatchAuthError();
    throw new AuthError("No access token");
  }

  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    cache: "no-store",
  });

  if (res.status === 401 || res.status === 403) {
    clearAccessToken();
    dispatchAuthError();
    throw new AuthError("Unauthorized");
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Error ${res.status}: ${errorText || res.statusText}`);
  }

  return res.json();
}

export async function publicFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Error ${res.status}: ${errorText || res.statusText}`);
  }

  return res.json();
}

export async function optionalAuthFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAccessToken();

  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Error ${res.status}: ${errorText || res.statusText}`);
  }

  return res.json();
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export { API_BASE, getAccessToken, clearAccessToken, isBrowser };