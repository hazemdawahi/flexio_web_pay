// src/routes/index.tsx

import React, { useEffect } from "react";
import { useSession } from "../context/SessionContext";
import { useNavigate, useSearchParams } from "@remix-run/react";

const Index: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const source = searchParams.get("source") || "";
  const productId = searchParams.get("productId") || "";

  console.log("source", source);
  console.log("productid", productId);

  const { setAccessToken } = useSession();

  useEffect(() => {
    if (token) {
      // Save the token to sessionStorage
      sessionStorage.setItem("checkoutToken", token);
    }

    if (productId) {
      // Save the product id to sessionStorage
      sessionStorage.setItem("productId", productId);
    }

    // Navigate directly to the UnifiedOptionsPage page
    navigate(`/UnifiedOptionsPage`, {
      replace: true,
      state: { source },
    });
  }, [navigate, token, source, productId, setAccessToken]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-xl">Redirecting...</p>
    </div>
  );
};

export default Index;
