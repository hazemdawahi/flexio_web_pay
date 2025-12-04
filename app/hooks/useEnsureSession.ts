import { useEffect, useRef } from "react";
import { useSession } from "~/context/SessionContext";
import { useRefreshSession } from "./useRefreshSession";
import { isBrowser, getAccessToken } from "~/lib/auth/apiClient";

/**
 * On first mount, if there's no AT anywhere (context or stored via apiClient),
 * try a single cookie-based refresh and populate session on success.
 */
export function useEnsureSession() {
  const { accessToken } = useSession();
  const { mutate, isPending } = useRefreshSession();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    // Use central token helper instead of touching sessionStorage directly
    const storedToken = isBrowser ? getAccessToken() : null;
    const hasStored = !!storedToken;

    // If nothing in context or stored token, kick a cookie-based refresh now.
    if (!accessToken && !hasStored && !isPending) {
      mutate(); // useRefreshSession will set accessToken + inApp on success
    }
  }, [accessToken, isPending, mutate]);
}
