// ~/provider/sessionProvider.tsx

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import SessionContext from "~/context/SessionContext";
import { refreshOnce } from "~/lib/auth/refreshOnce";

type Props = { children: React.ReactNode };

export default function SessionProvider({ children }: Props) {
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [inApp, setInAppState] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const initRef = useRef(false);

  const setAccessToken = useCallback((token: string | null) => {
    setAccessTokenState(token);
    if (token) {
      try {
        sessionStorage.setItem("accessToken", token);
      } catch {}
    } else {
      try {
        sessionStorage.removeItem("accessToken");
      } catch {}
    }
  }, []);

  const setInApp = useCallback((val: boolean) => {
    setInAppState(val);
    try {
      sessionStorage.setItem("inApp", val ? "true" : "false");
    } catch {}
  }, []);

  const logout = useCallback(() => {
    setAccessTokenState(null);
    try {
      sessionStorage.removeItem("accessToken");
      sessionStorage.removeItem("inApp");
    } catch {}
  }, []);

  const isAuthenticated = useMemo(() => !!accessToken, [accessToken]);

  // Listen for auth errors from apiClient
  useEffect(() => {
    const handleAuthError = () => {
      console.log("[SessionProvider] Auth error received, logging out");
      setAccessTokenState(null);
      try {
        sessionStorage.removeItem("accessToken");
      } catch {}
    };

    window.addEventListener("auth:error", handleAuthError);
    return () => {
      window.removeEventListener("auth:error", handleAuthError);
    };
  }, []);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    (async () => {
      try {
        const storedToken = sessionStorage.getItem("accessToken");
        const storedInApp = sessionStorage.getItem("inApp") === "true";

        if (storedToken) {
          setAccessTokenState(storedToken);
          setInAppState(storedInApp);
        } else {
          const res = await refreshOnce();
          if (res?.success && res?.data?.accessToken) {
            const at = res.data.accessToken;
            setAccessTokenState(at);
            try {
              sessionStorage.setItem("accessToken", at);
            } catch {}
            const ia = res.data.inapp === true;
            setInAppState(ia);
            try {
              sessionStorage.setItem("inApp", ia ? "true" : "false");
            } catch {}
          } else {
            setAccessTokenState(null);
            try {
              sessionStorage.removeItem("accessToken");
            } catch {}
          }
        }
      } catch (err) {
        console.warn("SessionProvider init error:", err);
        setAccessTokenState(null);
        try {
          sessionStorage.removeItem("accessToken");
        } catch {}
      } finally {
        setInitialized(true);
      }
    })();
  }, []);

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