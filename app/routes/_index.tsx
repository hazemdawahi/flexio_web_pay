// ~/routes/_index.tsx

import React, { useEffect, useRef } from "react";
import { useSession } from "~/context/SessionContext";
import { useNavigate, useSearchParams } from "react-router";

export const clientLoader = async () => {
  return null;
};

export default function Index() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { initialized, isAuthenticated } = useSession();
  const processedRef = useRef(false);

  // ONLY values that actually come from custom-button.js:
  //  - token      -> used here as the checkout token
  //  - productId  -> monitoring mode
  //  - source     -> original host page, passed along in navigation state
  const token = searchParams.get("token") || "";
  const source = searchParams.get("source") || "";
  const productId = searchParams.get("productId") || "";

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

    // -----------------------------------------
    // Persist context coming from custom-button
    // -----------------------------------------

    // Monitoring: productId comes via ?productId=...
    if (productId) {
      setSession("productId", productId);
    } else {
      clearSession("productId");
    }

    // Checkout: custom-button.js passes the checkout token as ?token=...
    // Store it under "checkoutToken" for UnifiedOptionsPage & hooks.
    if (token) {
      setSession("checkoutToken", token);
    }
    // NOTE: we intentionally do NOT clear "checkoutToken" if token is absent,
    // so we don't wipe it on internal navigations back to "/".

    // -----------------------------------------
    // Routing decision
    // -----------------------------------------

    // At this point:
    //  - checkout flows have "checkoutToken" in sessionStorage
    //  - monitoring flows have "productId" in sessionStorage
    //
    // We now just send the user either to the unified options page
    // (if already authenticated) or to login, carrying "source" in state.

    if (isAuthenticated) {
      navigate("/UnifiedOptionsPage", { replace: true, state: { source } });
    } else {
      navigate("/login", { replace: true, state: { source } });
    }
  }, [initialized, isAuthenticated, navigate, token, source, productId]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <p className="text-xl text-gray-700">Redirecting...</p>
    </div>
  );
}
