// src/routes/index.tsx

import React, { useEffect } from "react";
import { useSession } from "../context/SessionContext";
import { useNavigate, useSearchParams } from "@remix-run/react";

const Index: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const source = searchParams.get("source") || "";
  console.log("source", source);

  const { setAccessToken } = useSession();

  useEffect(() => {
    if (token) {
      // Save the token to sessionStorage
      sessionStorage.setItem("checkoutToken", token);
    }

    // Navigate directly to the purchase-options page
    navigate(`/purchase-options`, {
      replace: true,
      state: { source },
    });
  }, [navigate, token, source, setAccessToken]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-xl">Redirecting...</p>
    </div>
  );
};

export default Index;
