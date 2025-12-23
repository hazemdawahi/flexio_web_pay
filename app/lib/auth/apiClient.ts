// ~/lib/auth/apiClient.ts

import { refresh } from "./refresh";

// API base URL from environment variable, with fallback for development
export const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_HOST ||
  "http://192.168.1.121:8080";

const isBrowser = typeof window !== "undefined";

function getAccessToken(): string | null {
  if (!isBrowser) return null;
  try {
    return localStorage.getItem("accessToken");
  } catch {
    return null;
  }
}

function setAccessToken(token: string): void {
  if (!isBrowser) return;
  try {
    localStorage.setItem("accessToken", token);
  } catch {
    // ignore
  }
}

function clearAccessToken(): void {
  if (!isBrowser) return;
  try {
    localStorage.removeItem("accessToken");
  } catch {
    // ignore
  }
}

function isInApp(): boolean {
  if (!isBrowser) return false;
  try {
    return localStorage.getItem("inApp") === "true";
  } catch {
    return false;
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

  const makeRequest = async (accessToken: string) => {
    const headers = new Headers(options.headers || {});
    headers.set("Authorization", `Bearer ${accessToken}`);
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    return fetch(makeUrl(endpoint), {
      ...options,
      headers,
      cache: "no-store",
    });
  };

  let res = await makeRequest(token);

  // On 401/403 for in-app users, try refresh then retry
  if ((res.status === 401 || res.status === 403) && isInApp()) {
    const refreshRes = await refresh();

    if (refreshRes.success && refreshRes.data?.accessToken) {
      const newToken = refreshRes.data.accessToken;
      setAccessToken(newToken);
      res = await makeRequest(newToken);
    }
  }

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

export { getAccessToken, clearAccessToken, isBrowser };