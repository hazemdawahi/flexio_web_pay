
import React, { useEffect, useState } from "react";
import { useNavigate } from "@remix-run/react";
import { useRefreshSession } from "../hooks/useRefreshSession";
import { SessionContextType, RefreshResponseData } from "../types/session";
import SessionContext from "~/context/SessionContext";

interface SessionProviderProps {
  children: React.ReactNode;
}

const SessionProvider: React.FC<SessionProviderProps> = ({ children }) => {
  const navigate = useNavigate();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [inApp, setInApp] = useState<boolean>(false); // State for inApp
  const [loading, setLoading] = useState<boolean>(true); // Indicates if authentication is in progress

  // Use the custom refresh session hook
  const { mutate: refreshSession, isPending: isRefreshing } = useRefreshSession();

  useEffect(() => {
    // Trigger the refresh session mutation on component mount
    refreshSession(undefined, {
      onSuccess: (data: RefreshResponseData) => {
        console.log("Refresh response.data:", data);

        if (data.success && data.data?.accessToken) {
          // Save the access token in sessionStorage
          console.log("Access Token:", data.data.accessToken);
          sessionStorage.setItem("accessToken", data.data.accessToken);
          setAccessToken(data.data.accessToken);

          // Check if inApp flag is present and true
          if (data.data.inapp) {
            console.log("InApp flag is true");
            sessionStorage.setItem("inApp", "true");
            setInApp(true);
          } else {
            // Ensure inApp is false if not provided or false
            sessionStorage.setItem("inApp", "false");
            setInApp(false);
          }

          // Redirect to the merchant shopping page if currently on root
          if (window.location.pathname === "/") {
            navigate("/merchant-shopping");
          }
        } else {
          // If no valid token, redirect to login
          navigate("/login");
        }
      },
      onError: (error: Error) => {
        console.error("Authentication refresh failed:", error.message);
        // On error (e.g., network issues, invalid token), redirect to login
        navigate("/login");
      },
      onSettled: () => {
        setLoading(false); // Authentication process is complete
      },
    });
  }, [refreshSession, navigate]);

  if (loading || isRefreshing) {
    // Show a loading spinner while authenticating
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 font-sans">
        <h1 className="text-2xl font-bold">Logging in...</h1>
        <div className="mt-4 text-4xl animate-spin">🔄</div>
      </div>
    );
  }

  const contextValue: SessionContextType = {
    accessToken,
    inApp, // Provide inApp state to context
    setAccessToken,
    setInApp, // Provide setter for inApp
  };

  return (
    <SessionContext.Provider value={contextValue}>
      {children}
    </SessionContext.Provider>
  );
};

export default SessionProvider;
