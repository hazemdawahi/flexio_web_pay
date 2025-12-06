// ~/provider/sessionProvider.tsx

import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from "react";
import SessionContext from "~/context/SessionContext";
import { refreshOnce, RefreshResponseData } from "~/lib/auth/refreshOnce";

type Props = { children: React.ReactNode };

/**
 * Normalize backend flags (inapp / inApp / inappuse / inAppUse)
 * which may be booleans OR strings ("true"/"false"/"1"/"yes").
 *
 * Returns:
 * - true  => backend explicitly says "in-app"
 * - false => backend explicitly says "NOT in-app"
 * - null  => backend gave no usable flag (e.g. no data from refresh)
 */
function normalizeInAppFlag(
  data: RefreshResponseData["data"] | undefined
): boolean | null {
  if (!data) return null;

  const anyData = data as any;

  const raw =
    anyData.inapp ??
    anyData.inApp ??
    anyData.inappuse ??
    anyData.inAppUse;

  if (typeof raw === "boolean") {
    return raw;
  }

  if (typeof raw === "string") {
    const v = raw.trim().toLowerCase();
    if (!v) return null;
    if (v === "true" || v === "1" || v === "yes") return true;
    if (v === "false" || v === "0" || v === "no") return false;
  }

  return null;
}

/**
 * Read the non-HttpOnly "inappuse" cookie.
 * - returns true  => cookie says in-app
 * - returns false => cookie says not in-app
 * - returns null  => cookie not present / unreadable
 */
function readInAppCookie(): boolean | null {
  if (typeof document === "undefined") return null;
  const cookieStr = document.cookie || "";
  const match = cookieStr
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("inappuse="));

  if (!match) return null;

  const val = decodeURIComponent(match.split("=")[1] || "")
    .trim()
    .toLowerCase();

  if (val === "true") return true;
  if (val === "false") return false;
  return null;
}

export default function SessionProvider({ children }: Props) {
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  /**
   * Tri-state inApp:
   * - null  => unknown / not determined yet
   * - true  => in-app (mobile WebView)
   * - false => regular web flow
   */
  const [inApp, setInAppState] = useState<boolean | null>(null);
  const [initialized, setInitialized] = useState(false);
  const initRef = useRef(false);

  /** Setters that always sync to sessionStorage (when in a browser) */
  const setAccessToken = useCallback((token: string | null) => {
    setAccessTokenState(token);
    if (typeof window === "undefined") return;

    try {
      if (token) {
        window.sessionStorage.setItem("accessToken", token);
      } else {
        window.sessionStorage.removeItem("accessToken");
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const setInApp = useCallback((val: boolean | null) => {
    setInAppState(val);
    if (typeof window === "undefined") return;

    try {
      if (val === null) {
        // "unknown" => remove key, so next load can re-detect
        window.sessionStorage.removeItem("inApp");
      } else {
        window.sessionStorage.setItem("inApp", val ? "true" : "false");
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const logout = useCallback(() => {
    setAccessTokenState(null);
    setInAppState(null);

    if (typeof window === "undefined") return;

    try {
      window.sessionStorage.removeItem("accessToken");
      window.sessionStorage.removeItem("inApp");
    } catch {
      // ignore storage errors
    }
  }, []);

  const isAuthenticated = useMemo(() => !!accessToken, [accessToken]);

  // Listen for auth errors from apiClient (401/403 on authenticated calls)
  useEffect(() => {
    const handleAuthError = () => {
      // Token is no longer valid -> clear it.
      // We do NOT force-change inApp here; being "in-app" is orthogonal.
      setAccessToken(null);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("auth:error", handleAuthError);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("auth:error", handleAuthError);
      }
    };
  }, [setAccessToken]);

  // 🔑 Initialization: sync from storage, then (optionally) from backend refresh cookie
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    (async () => {
      try {
        let storedToken: string | null = null;
        let storedInAppRaw: string | null = null;

        if (typeof window !== "undefined") {
          try {
            storedToken = window.sessionStorage.getItem("accessToken");
            storedInAppRaw = window.sessionStorage.getItem("inApp");
          } catch {
            storedToken = null;
            storedInAppRaw = null;
          }
        }

        // inApp from storage:
        // - null  => no key stored yet
        // - true  => "true"
        // - false => "false"
        const storageInApp: boolean | null =
          storedInAppRaw === null ? null : storedInAppRaw === "true";

        // inApp from cookie (only set for in-app sessions)
        const cookieInApp: boolean | null = readInAppCookie();

        // 1) Seed from storage for fast UI
        if (storedToken) {
          setAccessTokenState(storedToken);
        }

        // 2) Initial in-app guess:
        //    storage value wins; else cookie; else null
        const initialInApp: boolean | null =
          storageInApp !== null ? storageInApp : cookieInApp;

        setInAppState(initialInApp);

        // 3) Decide if we should even call /refresh-tokens:
        //    ONLY if cookieInApp === true (mobile WebView flow).
        const shouldCallRefresh = cookieInApp === true;

        if (!shouldCallRefresh) {
          // Web-only flow:
          //  - We rely solely on the access token we already have in sessionStorage.
          //  - No refresh cookie, so don't ping /refresh-tokens (avoids 403 noise).
          return;
        }

        // 4) In-app flow: we *do* have refresh cookie, so try to refresh once.
        const res = await refreshOnce();

        const backendToken = res.data?.accessToken ?? null;
        const backendInApp = normalizeInAppFlag(res.data); // boolean | null

        // --- ACCESS TOKEN DECISION (in-app only) ---
        if (backendToken) {
          // Backend gave us a fresh access token -> treat as source of truth.
          setAccessToken(backendToken);
        } else {
          // No backend token (403, 401, or other error)=> treat as logged out for in-app.
          setAccessToken(null);
        }

        // --- IN-APP FLAG DECISION ---
        if (backendInApp !== null) {
          // Backend explicitly told us whether this refresh belongs to an in-app session.
          setInApp(backendInApp);
        } else if (initialInApp !== null) {
          // Fall back to whatever we inferred from storage/cookie
          setInApp(initialInApp);
        } else {
          setInApp(null);
        }
      } catch (err) {
        // On error:
        // - keep whatever came from storage
        // - don't force logout for web-only flows
      } finally {
        setInitialized(true);
      }
    })();
  }, [setAccessToken, setInApp]);

  const value = useMemo(
    () => ({
      accessToken,
      inApp,
      initialized,
      isAuthenticated,
      setAccessToken,
      setInApp,
      logout,
    }),
    [accessToken, inApp, initialized, isAuthenticated, setAccessToken, setInApp, logout]
  );

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}
