// src/components/SessionContext.tsx

import React, { createContext, useContext } from "react";
import { SessionContextType } from "../types/session";

const SessionContext = createContext<SessionContextType>({
  accessToken: null,
  setAccessToken: () => {},
});

// Custom hook to use the SessionContext
export const useSession = (): SessionContextType => useContext(SessionContext);

export default SessionContext;
