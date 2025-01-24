// src/components/SessionProvider.tsx

import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "@remix-run/react";
import { SessionContextType, RefreshResponseData } from "../types/session";
import SessionContext from "~/context/SessionContext";

interface SessionProviderProps {
  children: React.ReactNode;
}

const REFRESH_ENDPOINT = "http://192.168.1.32:8080/api/user/refresh";

const SessionProvider: React.FC<SessionProviderProps> = ({ children }) => {
  const navigate = useNavigate();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true); // Indicates if authentication is in progress

  useEffect(() => {
    const refreshAuth = async () => {
      try {
        const response = await axios.get<RefreshResponseData>(REFRESH_ENDPOINT, {
          headers: {
            Accept: "application/json",
          },
          withCredentials: true, // Ensure cookies are sent with the request
        });

        const responseData = response.data;
        console.log("Refresh response.data:", responseData);

        if (responseData.success && responseData.data?.accessToken) {
          // Save the access token in sessionStorage
          console.log("Access Token:", responseData.data.accessToken);
          sessionStorage.setItem("accessToken", responseData.data.accessToken);
          setAccessToken(responseData.data.accessToken);

          // Redirect to the merchant shopping page if currently on root
          if (window.location.pathname === "/") {
            navigate("/merchant-shopping");
          }
        } else {
          // If no valid token, redirect to login
          navigate("/login");
        }
      } catch (error) {
        console.error("Authentication refresh failed:", error);
        // On error (e.g., network issues, invalid token), redirect to login
        navigate("/login");
      } finally {
        setLoading(false); // Authentication process is complete
      }
    };

    refreshAuth();
  }, [navigate]);

  if (loading) {
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
    setAccessToken,
  };

  return (
    <SessionContext.Provider value={contextValue}>
      {children}
    </SessionContext.Provider>
  );
};

export default SessionProvider;
