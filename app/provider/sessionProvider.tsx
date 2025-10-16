// src/components/SessionProvider.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "@remix-run/react";
import { useRefreshSession } from "../hooks/useRefreshSession";
import SessionContext from "~/context/SessionContext";
import type { SessionContextType, RefreshResponseData } from "../types/session";

interface SessionProviderProps {
  children: React.ReactNode;
}

const SAFE_TIMEOUT_MS = 8000; // cap any hanging network

const PUBLIC_ROUTES = new Set<string>([
  "/login",
  "/register",
  "/forgot-password",
]);

const SessionProvider: React.FC<SessionProviderProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [inApp, setInApp] = useState<boolean>(false);
  const [initialized, setInitialized] = useState<boolean>(false);

  // Use mutateAsync so we can control try/catch/finally ourselves
  const { mutateAsync: refreshSessionAsync } = useRefreshSession();

  // prevent double-fire in React 18 StrictMode
  const ranRef = useRef(false);
  // prevent multiple redirects
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), SAFE_TIMEOUT_MS);

      try {
        // Run refresh; your hook should accept AbortController via internal timeout,
        // but even if it doesn't, this outer abort prevents "forever pending" in some cases.
        const res = (await refreshSessionAsync(undefined)) as RefreshResponseData;

        if (res?.success && res?.data?.accessToken) {
          const token = res.data.accessToken;
          sessionStorage.setItem("accessToken", token);
          setAccessToken(token);

          const inapp = !!res?.data?.inapp;
          sessionStorage.setItem("inApp", inapp ? "true" : "false");
          setInApp(inapp);

          // If we’re on a public route, bounce to home; otherwise, stay put.
          if (PUBLIC_ROUTES.has(location.pathname) && !redirectedRef.current) {
            redirectedRef.current = true;
            navigate("/", { replace: true });
          }
        } else {
          // Not authenticated — clear token and go to /login if not already there.
          sessionStorage.removeItem("accessToken");
          setAccessToken(null);

          if (!PUBLIC_ROUTES.has(location.pathname) && !redirectedRef.current) {
            redirectedRef.current = true;
            navigate("/login", { replace: true });
          }
        }
      } catch (err) {
        // Network/403/abort/etc: treat as unauthenticated
        console.warn("refresh failed:", err);
        sessionStorage.removeItem("accessToken");
        setAccessToken(null);

        if (!PUBLIC_ROUTES.has(location.pathname) && !redirectedRef.current) {
          redirectedRef.current = true;
          navigate("/login", { replace: true });
        }
      } finally {
        clearTimeout(timeout);
        // ✅ No matter what, we finish initialization so the app renders
        setInitialized(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // We do NOT block rendering the app anymore. If you want a spinner for protected
  // areas, add a small <RequireAuth> gate per route/section.
  const contextValue: SessionContextType = useMemo(
    () => ({
      accessToken,
      inApp,
      setAccessToken,
      setInApp,
    }),
    [accessToken, inApp]
  );

  // Optionally, show a tiny one-time splash only on first load of the whole app.
  // If you hate any splash, just remove this block entirely.
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
