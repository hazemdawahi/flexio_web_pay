// ~/routes/_index.tsx

import React, { useEffect, useRef } from "react";
import { useSession } from "~/context/SessionContext";
import { useNavigate, useSearchParams } from "@remix-run/react";

export const clientLoader = async () => {
  return null;
};

export default function Index() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { initialized, isAuthenticated } = useSession();
  const processedRef = useRef(false);

  const token = searchParams.get("token") || "";
  const source = searchParams.get("source") || "";
  const productId = searchParams.get("productId") || "";
  const checkoutToken = searchParams.get("checkoutToken") || "";
  const inApp = searchParams.get("inApp") === "true";
  const displayLogo = searchParams.get("displayLogo") || "";
  const displayName = searchParams.get("displayName") || "";
  const totalAmount = searchParams.get("totalAmount") || "";
  const amount = searchParams.get("amount") || "";
  const discountList = searchParams.get("discountList") || "";
  const splitPaymentId = searchParams.get("splitPaymentId") || "";

  useEffect(() => {
    if (!initialized) return;
    if (processedRef.current) return;
    processedRef.current = true;

    const setSession = (k: string, v: string) => {
      if (!v) return;
      try {
        sessionStorage.setItem(k, v);
      } catch {}
    };

    const clearSession = (k: string) => {
      try {
        sessionStorage.removeItem(k);
      } catch {}
    };

    // Store context in session
    if (checkoutToken) {
      setSession("checkoutToken", checkoutToken);
    } else {
      clearSession("checkoutToken");
    }

    setSession("productId", productId);
    setSession("displayLogo", displayLogo);
    setSession("displayName", displayName);
    setSession("totalAmount", totalAmount);
    setSession("amount", amount);
    setSession("discountList", discountList);
    setSession("splitPaymentId", splitPaymentId);

    if (inApp) {
      setSession("inApp", "true");
    }

    // If token in URL, redirect to login-token to handle auth
    if (token) {
      const params = new URLSearchParams();
      params.set("token", token);
      if (checkoutToken) params.set("checkoutToken", checkoutToken);
      if (inApp) params.set("inApp", "true");
      navigate(`/login?${params.toString()}`, { replace: true, state: { source } });
      return;
    }

    // No token - check if already authenticated
    if (isAuthenticated) {
      navigate("/UnifiedOptionsPage", { replace: true, state: { source } });
    } else {
      navigate("/login", { replace: true, state: { source } });
    }
  }, [
    initialized,
    isAuthenticated,
    navigate,
    token,
    source,
    productId,
    checkoutToken,
    inApp,
    displayLogo,
    displayName,
    totalAmount,
    amount,
    discountList,
    splitPaymentId,
  ]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <p className="text-xl text-gray-700">Redirecting...</p>
    </div>
  );
}