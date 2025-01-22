import React, { useEffect, useState } from "react";

export default function RootRoute() {
  const [refreshTokenMessage, setRefreshTokenMessage] = useState("Loading...");

  useEffect(() => {
    async function fetchCookies() {
      try {
        const response = await fetch(
          "https://romantic-walleye-moderately.ngrok-free.app/api/user/log-cookies",
          {
            method: "GET",
            headers: {
              Accept: "application/json"
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Error: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        if (data.refreshToken) {
          setRefreshTokenMessage(`Refresh Token: ${data.refreshToken}`);
        } else {
          setRefreshTokenMessage("No refresh token found");
        }
      } catch (error) {
        setRefreshTokenMessage(
          `Failed to fetch cookies: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    fetchCookies();
  }, []);

  return (
    <div style={styles.container}>
      <h1>Refresh Token Status</h1>
      <pre style={styles.pre}>{refreshTokenMessage}</pre>
    </div>
  );
}

const styles = {
  container: { fontFamily: "sans-serif", padding: "1rem" },
  pre: { backgroundColor: "#f4f4f4", padding: "1rem", borderRadius: "5px" },
};
