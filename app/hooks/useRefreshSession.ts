import { useMutation } from "@tanstack/react-query";
 import { useSession } from "~/context/SessionContext";
import { refreshOnce } from "~/lib/auth/refreshOnce";

export type RefreshResponse = {
  success: boolean;
  data?: { accessToken?: string; inapp?: boolean };
  error?: string;
};

export function useRefreshSession() {
  const { setAccessToken, setInApp } = useSession();

  return useMutation<RefreshResponse, Error, void>({
    mutationFn: async () => {
      const res = await refreshOnce();

      if (res?.success && res?.data?.accessToken) {
        const at = res.data.accessToken!;
        try {
          sessionStorage.setItem("accessToken", at);
        } catch {
          // ignore storage errors (e.g., SSR or disabled storage)
        }
        setAccessToken(at);

        const inapp = res?.data?.inapp === true;
        setInApp(inapp);
        try {
          sessionStorage.setItem("inApp", inapp ? "true" : "false");
        } catch {
          // ignore storage errors
        }
      }

      if (!res?.success) {
        throw new Error(res?.error || "Refresh failed");
      }

      return {
        success: res.success,
        data: res.data,
        error: res.error,
      };
    },
  });
}
