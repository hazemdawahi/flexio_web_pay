import React, { useContext } from "react";
import { SessionContextType } from "../types/session";

const SessionContext = React.createContext<SessionContextType>({
  accessToken: null,
  inApp: false,
  initialized: false,     // ← default
  setAccessToken: () => {},
  setInApp: () => {},
});

export const useSession = (): SessionContextType => useContext(SessionContext);
export default SessionContext;
