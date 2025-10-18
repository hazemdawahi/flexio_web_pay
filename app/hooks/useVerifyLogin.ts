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
    const response = await fetch('http://192.168.1.121:8080/api/user/verify/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(verifyRequest),
      signal: controller.signal,
      cache: 'no-store',
      credentials: 'include', // server sets HttpOnly refresh cookie
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

        // 🔒 Do NOT force true. Only accept explicit boolean from server if provided.
        const explicitInApp = data?.data?.inapp === true;
        setInApp(explicitInApp);
        try { sessionStorage.setItem("inApp", explicitInApp ? "true" : "false"); } catch {}
      }
      // HttpOnly refresh cookie (if any) is set by server; refresh flow will reflect it.
    },
  });
}
