import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const API_BASE = 'http://192.168.1.121:8080';
const LOGOUT_ENDPOINT = `${API_BASE}/api/user/logout`;

declare global {
  interface Window {
    OneSignal?: any;
    sb?: { disconnect?: () => Promise<void> | void };
  }
}

function broadcastLogout() {
  try {
    const bc = new BroadcastChannel('auth');
    bc.postMessage({ type: 'LOGOUT' });
    bc.close();
  } catch {}
}

async function oneSignalWebLogout() {
  try { if (window.OneSignal?.User?.PushSubscription?.optOut) await window.OneSignal.User.PushSubscription.optOut(); } catch {}
  try { if (window.OneSignal?.logout) await window.OneSignal.logout(); } catch {}
  try {
    if (window.OneSignal?.setSubscription) await window.OneSignal.setSubscription(false);
    if (window.OneSignal?.setConsentGiven) await window.OneSignal.setConsentGiven(false);
  } catch {}
}

export function useLogoutWeb(options?: { disconnect?: () => Promise<void> | void; redirectTo?: string }) {
  const injectedDisconnect = options?.disconnect;
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const guardRef = useRef(false);
  const queryClient = useQueryClient();

  const logout = useCallback(async () => {
    if (guardRef.current) return;
    guardRef.current = true;
    setIsLoggingOut(true);

    // 1) Read access token BEFORE cleanup so we can send it to the server (session only)
    const accessToken = sessionStorage.getItem('accessToken') ?? undefined;

    // 2) Call server revoke and WAIT for it (no keepalive).
    //    Refresh cookie is HttpOnly and will be included via credentials=include.
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

      await fetch(LOGOUT_ENDPOINT, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({}), // body not required
      });
    } catch (e) {
      console.warn('Logout fetch failed:', e);
    }

    // 3) Local cleanup AFTER server call (session only)
    try { sessionStorage.removeItem('accessToken'); } catch {}

    await oneSignalWebLogout();

    try {
      if (typeof injectedDisconnect === 'function') await injectedDisconnect();
      else if (window.sb?.disconnect) await window.sb.disconnect();
    } catch {}

    try {
      await queryClient.cancelQueries();
      queryClient.clear();
    } catch {}

    // 4) Tell other tabs to purge their in-memory state immediately
    broadcastLogout();

    setIsLoggingOut(false);
    guardRef.current = false;

    // 5) Hard navigation (no SPA state survives)
    const to = options?.redirectTo ?? '/login';
    window.location.replace(to);
  }, [injectedDisconnect, queryClient, options?.redirectTo]);

  return { logout, isLoggingOut };
}

// Optional: somewhere central in your app bootstrap, listen and react in every tab:
export function registerAuthBroadcastListener(purge: () => void) {
  try {
    const bc = new BroadcastChannel('auth');
    bc.onmessage = (e) => {
      if (e?.data?.type === 'LOGOUT') {
        try { purge(); } catch {}
        try { sessionStorage.removeItem('accessToken'); } catch {}
        window.location.replace('/login');
      }
    };
    return () => bc.close();
  } catch {
    return () => {};
  }
}
