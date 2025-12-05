// ~/lib/api/apiClient.ts

// We are 100% static here: backend is always on this host/port in dev.
const API_BASE = "http://192.168.1.121:8080";

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
  } catch {
    // ignore
  }
}

function dispatchAuthError(): void {
  if (!isBrowser) return;
  try {
    window.dispatchEvent(new CustomEvent("auth:error"));
  } catch {
    // ignore
  }
}

/**
 * Join API_BASE and endpoint safely:
 * - strips trailing slashes from base
 * - strips leading slashes from endpoint
 */
function makeUrl(endpoint: string): string {
  const base = API_BASE.replace(/\/+$/, "");
  const path = endpoint.replace(/^\/+/, "");
  return `${base}/${path}`;
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

  const res = await fetch(makeUrl(endpoint), {
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

  const res = await fetch(makeUrl(endpoint), {
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

  const res = await fetch(makeUrl(endpoint), {
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
