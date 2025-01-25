// src/components/SessionContext.tsx

// src/context/SessionContext.tsx

import React, { useContext } from "react";
import { SessionContextType } from "../types/session";

const SessionContext = React.createContext<SessionContextType>({
  accessToken: null,
  inApp: false, // Default value for inApp
  setAccessToken: () => {},
  setInApp: () => {}, // Default setter for inApp
});



// Custom hook to use the SessionContext
export const useSession = (): SessionContextType => useContext(SessionContext);

export default SessionContext;
