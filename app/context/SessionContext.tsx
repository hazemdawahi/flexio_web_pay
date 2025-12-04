// ~/context/SessionContext.ts

import React, { useContext } from "react";

export interface SessionContextType {
  accessToken: string | null;
  inApp: boolean;
  initialized: boolean;
  isAuthenticated: boolean;
  setAccessToken: (token: string | null) => void;
  setInApp: (val: boolean) => void;
  logout: () => void;
}

const SessionContext = React.createContext<SessionContextType>({
  accessToken: null,
  inApp: false,
  initialized: false,
  isAuthenticated: false,
  setAccessToken: () => {},
  setInApp: () => {},
  logout: () => {},
});

export const useSession = (): SessionContextType => useContext(SessionContext);
export default SessionContext;