// ~/hooks/useLogin.ts

import { useMutation } from "@tanstack/react-query";
import { publicFetch } from "~/lib/auth/apiClient";

export interface LoginRequest {
  identifier: string;
}

export interface LoginResponse {
  success: boolean;
  data: string;
  error: string | null;
}

export function useLogin() {
  return useMutation<LoginResponse, Error, LoginRequest>({
    mutationFn: (data) =>
      publicFetch<LoginResponse>("/api/user/login", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      console.log("OTP sent:", data);
    },
    onError: (error) => {
      console.error("Login failed:", error.message);
    },
  });
}
