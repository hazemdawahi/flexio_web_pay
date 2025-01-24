// src/types/session.ts

export interface RefreshResponseData {
    success: boolean;
    data?: {
      accessToken: string;
    };
    message?: string;
  }
  
  export interface SessionContextType {
    accessToken: string | null;
    setAccessToken: (token: string | null) => void;
  }
  