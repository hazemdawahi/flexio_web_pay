import { useMutation } from "@tanstack/react-query";
import { refreshOnce } from "~/lib/auth/refreshOnce";
import { useSession } from "~/context/SessionContext";

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
        } catch {}
        setAccessToken(at);

        const inapp = res?.data?.inapp === true;
        setInApp(inapp);
        try { sessionStorage.setItem("inApp", inapp ? "true" : "false"); } catch {}
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
