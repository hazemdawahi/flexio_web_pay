export interface RefreshResponseData {
  success: boolean;
  data?: { accessToken: string; inapp?: boolean };
  error?: string;
}

export interface SessionContextType {
  accessToken: string | null;
  inApp: boolean;
  initialized: boolean;              // ← provider exposes init status
  setAccessToken: (token: string | null) => void;
  setInApp: (inApp: boolean) => void;
}
