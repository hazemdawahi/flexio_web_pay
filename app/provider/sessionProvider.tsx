// app/sessionProvider.tsx
import React, { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "@remix-run/react";

interface SessionContextValue {
  isAuthenticated: boolean;
}

const SessionContext = createContext<SessionContextValue>({
  isAuthenticated: false,
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  // Start with a "pending" authentication state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Parse cookies from document.cookie
    const cookies = document.cookie.split(";").reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split("=");
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    if (cookies.refreshToken) {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  // While authentication status is pending, render a loading spinner
  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent border-solid rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <SessionContext.Provider value={{ isAuthenticated }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
