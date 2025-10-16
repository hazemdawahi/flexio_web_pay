// File: app/hooks/useLogoutWeb.ts
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

function getBaseDomain(hostname: string): string | null {
  if (hostname === 'localhost' || /^[\d.]+$/.test(hostname) || hostname.includes(':')) return null;
  const parts = hostname.split('.');
  if (parts.length <= 2) return hostname;
  return parts.slice(-2).join('.');
}

function deleteCookie(name: string) {
  try {
    const hn = location.hostname;
    const base = getBaseDomain(hn);

    document.cookie = `${encodeURIComponent(name)}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
    document.cookie = `${encodeURIComponent(name)}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Strict`;
    if (hn && hn !== 'localhost') {
      document.cookie = `${encodeURIComponent(name)}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax; domain=${hn}`;
      document.cookie = `${encodeURIComponent(name)}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Strict; domain=${hn}`;
    }
    if (base && base !== hn) {
      document.cookie = `${encodeURIComponent(name)}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax; domain=${base}`;
      document.cookie = `${encodeURIComponent(name)}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Strict; domain=${base}`;
    }
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

    const accessToken =
      localStorage.getItem('accessToken') ?? sessionStorage.getItem('accessToken') ?? undefined;
    const refreshHeader =
      localStorage.getItem('refreshToken') ?? sessionStorage.getItem('refreshToken') ?? undefined;

    try {
      // Local cleanup first
      try { localStorage.removeItem('accessToken'); } catch {}
      try { localStorage.removeItem('refreshToken'); } catch {}
      try { sessionStorage.removeItem('accessToken'); } catch {}
      try { sessionStorage.removeItem('refreshToken'); } catch {}
      deleteCookie('refreshToken');
      await oneSignalWebLogout();
      try {
        if (typeof injectedDisconnect === 'function') await injectedDisconnect();
        else if (window.sb?.disconnect) await window.sb.disconnect();
      } catch {}
      try {
        await queryClient.cancelQueries();
        queryClient.clear();
      } catch {}
    } finally {
      setIsLoggingOut(false);
    }

    // Tell server to revoke + clear cookie and THEN hard-redirect
    try {
      await fetch(LOGOUT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...(refreshHeader ? { 'Refresh-Token': refreshHeader } : {}),
        },
        credentials: 'include',
      });
    } catch (e) {
      console.warn('Background logout failed:', e);
    } finally {
      guardRef.current = false;
      const to = options?.redirectTo ?? '/login';
      window.location.replace(to); // hard navigation; no in-memory state survives
    }
  }, [injectedDisconnect, queryClient, options?.redirectTo]);

  return { logout, isLoggingOut };
}
