// src/types/session.ts

export interface RefreshResponseData {
    success: boolean;
    data?: {
      accessToken: string;
      inapp?: boolean;
    };
    error?: string;
  }
  
  export interface SessionContextType {
    accessToken: string | null;
    inApp: boolean; // Added inApp state
    setAccessToken: (token: string | null) => void;
    setInApp: (inApp: boolean) => void; // Setter for inApp state
  }
  