import { useMutation } from '@tanstack/react-query';
import { useSession } from '~/context/SessionContext';

export interface VerifyLoginRequest {
  identifier: string;
  otp: string;
}

export interface VerifyLoginResponse {
  success: boolean;
  data?: { accessToken: string; inapp?: boolean };
  error?: string;
}

async function verifyLoginData(verifyRequest: VerifyLoginRequest): Promise<VerifyLoginResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    // Use /verify/login-web endpoint - NO refresh token, NO refresh cookie
    const response = await fetch('http://localhost:8080/api/user/verify/login-web', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(verifyRequest),
      signal: controller.signal,
      cache: 'no-store',
      // No credentials needed since we're not using cookies for this flow
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Verification failed: ${errorData?.error || response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

export function useVerifyLogin() {
  const { setAccessToken, setInApp } = useSession();

  return useMutation<VerifyLoginResponse, Error, VerifyLoginRequest>({
    mutationFn: verifyLoginData,
    onSuccess: (data) => {
      if (data?.success && data?.data?.accessToken) {
        const at = data.data.accessToken;
        try {
          sessionStorage.setItem('accessToken', at);
          console.log("accessToken", at);
        } catch {}
        setAccessToken(at);

        // Web-only login: always false for inApp
        const explicitInApp = data?.data?.inapp === true;
        setInApp(explicitInApp);
        try {
          sessionStorage.setItem("inApp", explicitInApp ? "true" : "false");
        } catch {}
      }
      // No refresh cookie is set by server for this endpoint
    },
  });
}