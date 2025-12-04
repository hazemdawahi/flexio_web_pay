import React, { useEffect } from "react";
import { useSession } from "../context/SessionContext";
import { useNavigate, useSearchParams } from "@remix-run/react";

const API_BASE = "http://localhost:8080";

const Index: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const token         = searchParams.get("token")         || "";
  const source        = searchParams.get("source")        || "";
  const productId     = searchParams.get("productId")     || "";
  const rt            = searchParams.get("rt")            || ""; // incoming refresh token (one-shot ingest)
  const displayLogo   = searchParams.get("displayLogo")   || "";
  const displayName   = searchParams.get("displayName")   || "";
  const totalAmount   = searchParams.get("totalAmount")   || "";
  const amount        = searchParams.get("amount")        || "";
  const discountList  = searchParams.get("discountList")  || "";
  const splitPaymentId= searchParams.get("splitPaymentId")|| "";

  const { setAccessToken, setInApp } = useSession();

  useEffect(() => {
    (async () => {
      try {
        const setSession = (k: string, v: string) => {
          if (!v) return;
          try { sessionStorage.setItem(k, v); } catch {}
        };
        const clearSession = (k: string) => {
          try { sessionStorage.removeItem(k); } catch {}
        };

        // If we *have* a fresh token, overwrite; if not, clear any stale one.
        if (token) setSession("checkoutToken", token);
        else       clearSession("checkoutToken");

        // Store aux context in session only (ephemeral)
        setSession("productId",     productId);
        setSession("displayLogo",   displayLogo);
        setSession("displayName",   displayName);
        setSession("totalAmount",   totalAmount);
        setSession("amount",        amount);
        setSession("discountList",  discountList);
        setSession("splitPaymentId",splitPaymentId);

        // If we were launched with a refresh token, ingest it server-side (sets cookie).
        if (rt) {
          const res = await fetch(`${API_BASE}/api/user/ingest-refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include", // so Set-Cookie lands
            body: JSON.stringify({ refreshToken: rt }),
          });

          const json = await res.json().catch(() => ({}));
          if (res.ok && json?.success && json?.data?.accessToken) {
            const at = json.data.accessToken;
            try { sessionStorage.setItem("accessToken", at); } catch {}
            setAccessToken(at);

            // Only set inApp if server explicitly returns it
            const inapp = json?.data?.inapp === true;
            setInApp(inapp);
            try { sessionStorage.setItem("inApp", inapp ? "true" : "false"); } catch {}
          } else {
            console.warn("Failed to ingest refresh:", json?.error || res.status);
          }
        }
      } finally {
        // Navigate to main page (strip rt/token/etc. using replace)
        navigate(`/UnifiedOptionsPage`, { replace: true, state: { source } });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    navigate,
    token,
    source,
    productId,
    rt,
    setAccessToken,
    setInApp,
    displayLogo,
    displayName,
    totalAmount,
    amount,
    discountList,
    splitPaymentId,
  ]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-xl">Redirecting...</p>
    </div>
  );
};

export default Index;
