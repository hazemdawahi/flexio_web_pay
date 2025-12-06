// ~/hooks/useVerifyLogin.ts

import { useMutation } from "@tanstack/react-query";
import { useSession } from "~/context/SessionContext";
import { publicFetch } from "~/lib/auth/apiClient";

export interface VerifyLoginRequest {
  identifier: string;
  otp: string;
}

export interface VerifyLoginResponse {
  success: boolean;
  data?: {
    accessToken: string;
    // no inapp here for web-only login
  };
  error?: string;
}

export function useVerifyLogin() {
  const { setAccessToken, setInApp } = useSession();

  return useMutation<VerifyLoginResponse, Error, VerifyLoginRequest>({
    mutationFn: async (data) => {
      const res = await publicFetch<VerifyLoginResponse>(
        "/api/user/verify/login-web",
        {
          method: "POST",
          body: JSON.stringify(data),
        }
      );

      // Normalize errors so React Query's `error` is set properly
      if (!res?.success) {
        throw new Error(res?.error || "Login verification failed");
      }

      return res;
    },
    onSuccess: (data) => {
      if (data?.success && data?.data?.accessToken) {
        const at = data.data.accessToken;

        // Persist access token
        try {
          sessionStorage.setItem("accessToken", at);
        } catch {
          // ignore storage errors
        }
        setAccessToken(at);

        // Web-only login → explicitly mark as not in-app
        setInApp(false);
        try {
          sessionStorage.setItem("inApp", "false");
        } catch {
          // ignore storage errors
        }
      }
    },
    onError: (error) => {
      console.error("Verify login failed:", error.message);
    },
  });
}
