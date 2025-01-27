// src/routes/index.tsx

import React, { useEffect } from "react";
import { useSession } from "../context/SessionContext";
import { useNavigate, useSearchParams } from "@remix-run/react";

const Index: React.FC = () => {
  // Initialize navigation
  const navigate = useNavigate();

  // Extract query parameters
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || ""; // 'token' serves as 'checkoutId'
  const source = searchParams.get("source") || ""; // 'source' parameter
   console.log("source",source)
  // Access session information (accessToken is separate from 'token')
  const { setAccessToken } = useSession();

  useEffect(() => {
    if (token) {
      // Save the token to sessionStorage
      sessionStorage.setItem("checkoutToken", token);
    }

    // Decide where to navigate based on accessToken
    const accessToken = sessionStorage.getItem("accessToken");
    if (accessToken) {
      // If accessToken exists, navigate to checkout details
      navigate(`/checkout-details`, {
        replace: true,
        state: { source },
      });
    } else {
      // If no accessToken, navigate to login page
      navigate(`/login`, {
        replace: true,
        state: { source },
      });
    }
  }, [navigate, token, source, setAccessToken]);

  // Optionally, render a simple loading state while redirecting
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-xl">Redirecting...</p>
    </div>
  );
};

export default Index;
