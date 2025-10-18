import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "@remix-run/react";
import SessionContext from "~/context/SessionContext";
import type { SessionContextType } from "../types/session";
import { refreshOnce } from "~/lib/auth/refreshOnce";
import { useEnsureSession } from "~/hooks/useEnsureSession";

const SAFE_TIMEOUT_MS = 8000;
const PUBLIC_ROUTES = new Set<string>(["/login", "/register", "/forgot-password"]);

/** Read a non-HttpOnly cookie (returns null if not visible/absent) */
function readCookie(name: string): string | null {
  try {
    const m = document.cookie
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.toLowerCase().startsWith(`${name.toLowerCase()}=`));
    return m ? decodeURIComponent(m.split("=")[1] ?? "") : null;
  } catch {
    return null;
  }
}

/** Strict inApp decision:
 *  - TRUE only if refresh JSON says true OR readable cookie inappuse=true
 *  - FALSE for everything else (no fallback to past session values)
 */
function computeInApp(refreshInapp?: unknown, cookieName = "inappuse"): boolean {
  if (refreshInapp === true) return true;
  const c = readCookie(cookieName);
  return (c ?? "").toLowerCase() === "true";
}

interface SessionProviderProps {
  children: React.ReactNode;
}

const SessionProvider: React.FC<SessionProviderProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [inApp, setInApp] = useState<boolean>(false);
  const [initialized, setInitialized] = useState<boolean>(false);

  // Keep your one-shot cookie-based refresh path
  useEnsureSession();

  const ranRef = useRef(false);
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), SAFE_TIMEOUT_MS);

      try {
        // DO NOT trust any prior inApp value; start from explicit false
        // and only set true after we can confirm it via refresh/cookie.
        // Also, do not force inApp=true when we just have an AT.

        // 1) Do we already have an access token in session storage?
        let existingAT: string | null = null;
        try {
          existingAT = sessionStorage.getItem("accessToken");
        } catch {}

        if (existingAT) {
          setAccessToken(existingAT);

          // Strictly compute inApp (true only if cookie or server says so)
          const bootInApp = computeInApp(undefined, "inappuse");
          setInApp(bootInApp);
          try {
            sessionStorage.setItem("inApp", bootInApp ? "true" : "false");
          } catch {}

          setInitialized(true);

          if (PUBLIC_ROUTES.has(location.pathname) && !redirectedRef.current) {
            redirectedRef.current = true;
            navigate("/", { replace: true });
          }
          return;
        }

        // 2) No AT → attempt cookie-based refresh; server may set HttpOnly cookie.
        const res = await refreshOnce({ signal: controller.signal });

        if (res?.success && res?.data?.accessToken) {
          const at = res.data.accessToken!;
          try { sessionStorage.setItem("accessToken", at); } catch {}
          setAccessToken(at);

          // 🔑 TRUE only if res.data.inapp === true, or readable cookie says true
          const nextInApp = computeInApp(res?.data?.inapp, "inappuse");
          setInApp(nextInApp);
          try { sessionStorage.setItem("inApp", nextInApp ? "true" : "false"); } catch {}

          if (PUBLIC_ROUTES.has(location.pathname) && !redirectedRef.current) {
            redirectedRef.current = true;
            navigate("/", { replace: true });
          }
        } else {
          // 3) No session: inApp must be false.
          try { sessionStorage.removeItem("accessToken"); } catch {}
          setAccessToken(null);
          setInApp(false);
          try { sessionStorage.setItem("inApp", "false"); } catch {}

          if (!PUBLIC_ROUTES.has(location.pathname) && !redirectedRef.current) {
            redirectedRef.current = true;
            navigate("/login", { replace: true });
          }
        }
      } catch (err) {
        console.warn("session init failed:", err);
        try { sessionStorage.removeItem("accessToken"); } catch {}
        setAccessToken(null);
        setInApp(false);
        try { sessionStorage.setItem("inApp", "false"); } catch {}

        if (!PUBLIC_ROUTES.has(location.pathname) && !redirectedRef.current) {
          redirectedRef.current = true;
          navigate("/login", { replace: true });
        }
      } finally {
        clearTimeout(timeout);
        setInitialized(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const contextValue: SessionContextType = useMemo(
    () => ({
      accessToken,
      inApp,
      initialized,
      setAccessToken: (t) => {
        setAccessToken(t);
        try {
          if (t) sessionStorage.setItem("accessToken", t);
          else sessionStorage.removeItem("accessToken");
        } catch {}
      },
      setInApp: (val) => {
        // still expose for UX, but the source of truth is server/cookie logic above
        setInApp(val);
        try { sessionStorage.setItem("inApp", val ? "true" : "false"); } catch {}
      },
    }),
    [accessToken, inApp, initialized]
  );

  if (!initialized && !PUBLIC_ROUTES.has(location.pathname)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 font-sans">
        <h1 className="text-2xl font-bold">Logging in...</h1>
        <div className="mt-4 text-4xl animate-spin">🔄</div>
      </div>
    );
  }

  return (
    <SessionContext.Provider value={contextValue}>
      {children}
    </SessionContext.Provider>
  );
};

export default SessionProvider;
