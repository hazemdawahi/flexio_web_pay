// ~/context/SessionContext.ts

import React, { useContext } from "react";

export interface SessionContextType {
  accessToken: string | null;
  /**
   * Tri-state:
   * - null  => not yet determined / unknown
   * - true  => confirmed in-app (mobile WebView)
   * - false => confirmed regular web flow
   */
  inApp: boolean | null;
  initialized: boolean;
  isAuthenticated: boolean;
  setAccessToken: (token: string | null) => void;
  setInApp: (val: boolean | null) => void;
  logout: () => void;
}

const SessionContext = React.createContext<SessionContextType>({
  accessToken: null,
  inApp: null,
  initialized: false,
  isAuthenticated: false,
  setAccessToken: () => {},
  setInApp: () => {},
  logout: () => {},
});

export const useSession = (): SessionContextType => useContext(SessionContext);
export default SessionContext;
