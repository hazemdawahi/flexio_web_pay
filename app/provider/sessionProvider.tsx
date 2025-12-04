import React, { useEffect, useState, useCallback, useRef } from "react";
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
          }
        }
      } catch (err) {
        console.warn("SessionProvider init error:", err);
      } finally {
        setInitialized(true);
      }
    })();
  }, []);

  return (
    <SessionContext.Provider
      value={{ accessToken, inApp, initialized, setAccessToken, setInApp }}
    >
      {children}
    </SessionContext.Provider>
  );
}