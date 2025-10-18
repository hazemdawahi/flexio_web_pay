// A tiny fetch wrapper that:
//  1) Adds Authorization: Bearer <accessToken> if present
//  2) On a 401 once, tries cookie-based refresh and retries the request

import { refreshOnce } from "./refreshOnce";

export async function fetchWithAuth(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const doFetch = async (): Promise<Response> => {
    const at =
      (typeof sessionStorage !== "undefined" &&
        sessionStorage.getItem("accessToken")) ||
      null;

    const headers = new Headers(init.headers || {});
    if (at) headers.set("Authorization", `Bearer ${at}`);

    return fetch(input, {
      ...init,
      headers,
      credentials: init.credentials ?? "include",
      cache: init.cache ?? "no-store",
    });
  };

  let res = await doFetch();
  if (res.status !== 401) return res;

  // One retry: try refreshing via HttpOnly cookie
  const refreshed = await refreshOnce();
  if (refreshed?.success && refreshed?.data?.accessToken) {
    const newAT = refreshed.data.accessToken!;
    try {
      sessionStorage.setItem("accessToken", newAT);
    } catch {}
    res = await doFetch();
  }

  return res;
}
