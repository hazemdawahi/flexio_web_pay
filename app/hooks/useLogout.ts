// ~/hooks/useLogout.ts

import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
 import { useSession } from "~/context/SessionContext";
import { API_BASE, getAccessToken } from "~/lib/auth/apiClient";

declare global {
  interface Window {
    OneSignal?: any;
    sb?: { disconnect?: () => Promise<void> | void };
  }
}

function broadcastLogout() {
  try {
    const bc = new BroadcastChannel("auth");
    bc.postMessage({ type: "LOGOUT" });
    bc.close();
  } catch {}
}

async function oneSignalWebLogout() {
  try {
    if (window.OneSignal?.User?.PushSubscription?.optOut)
      await window.OneSignal.User.PushSubscription.optOut();
  } catch {}
  try {
    if (window.OneSignal?.logout) await window.OneSignal.logout();
  } catch {}
  try {
    if (window.OneSignal?.setSubscription)
      await window.OneSignal.setSubscription(false);
    if (window.OneSignal?.setConsentGiven)
      await window.OneSignal.setConsentGiven(false);
  } catch {}
}

export function useLogoutWeb(options?: {
  disconnect?: () => Promise<void> | void;
  redirectTo?: string;
}) {
  const injectedDisconnect = options?.disconnect;
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const guardRef = useRef(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { logout: clearSession } = useSession();

  const logout = useCallback(async () => {
    if (guardRef.current) return;
    guardRef.current = true;
    setIsLoggingOut(true);

    const accessToken = getAccessToken();

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

      await fetch(`${API_BASE}/api/user/logout`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({}),
      });
    } catch (e) {
      console.warn("Logout fetch failed:", e);
    }

    // Clear session via context
    clearSession();

    await oneSignalWebLogout();

    try {
      if (typeof injectedDisconnect === "function") await injectedDisconnect();
      else if (window.sb?.disconnect) await window.sb.disconnect();
    } catch {}

    try {
      await queryClient.cancelQueries();
      queryClient.clear();
    } catch {}

    broadcastLogout();

    setIsLoggingOut(false);
    guardRef.current = false;

    const to = options?.redirectTo ?? "/login";
    navigate(to, { replace: true });
  }, [injectedDisconnect, queryClient, navigate, options?.redirectTo, clearSession]);

  return { logout, isLoggingOut };
}