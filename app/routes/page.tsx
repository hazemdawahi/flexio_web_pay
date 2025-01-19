import { useEffect, useState } from "react";
import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [
    { title: "Checkout Iframe" },
    { name: "description", content: "Iframe that receives tokens." },
  ];
};

export default function IframePage() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [checkoutId, setCheckoutId] = useState<string | null>(null);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      // REMOVE or adjust this check if you are testing on different hosts
      // e.g., if (event.origin !== "http://localhost:5500") return;

      if (event.data && typeof event.data === "object") {
        const { flexio_access_token, flexio_refresh_token, checkout_id } = event.data;
        if (flexio_access_token) setAccessToken(flexio_access_token);
        if (flexio_refresh_token) setRefreshToken(flexio_refresh_token);
        if (checkout_id) setCheckoutId(checkout_id);
      }
    }

    // Listen for message from parent
    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  return (
    <div style={styles.container}>
      <h1>Iframe Page</h1>
      <p>This page is loaded inside an iframe.</p>

      <div style={styles.tokensBox}>
        <p><strong>Access Token:</strong> {accessToken ?? "No access token received yet."}</p>
        <p><strong>Refresh Token:</strong> {refreshToken ?? "No refresh token received yet."}</p>
        <p><strong>Checkout ID:</strong> {checkoutId ?? "No checkout ID received yet."}</p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    fontFamily: "sans-serif",
    padding: "1rem",
  },
  tokensBox: {
    marginTop: "1rem",
    border: "1px solid #ddd",
    padding: "1rem",
    borderRadius: "4px",
  },
} as const;
