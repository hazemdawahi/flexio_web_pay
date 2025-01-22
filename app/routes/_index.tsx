import React, { useEffect, useState } from "react";
import axios from "axios";

export default function RootRoute() {
  const [refreshTokenMessage, setRefreshTokenMessage] = useState("Loading...");

  useEffect(() => {
    async function fetchCookies() {
      try {
        const response = await axios.get(
          "https://romantic-walleye-moderately.ngrok-free.app/api/user/log-cookies",
          {
            headers: {
              Accept: "application/json",
            },
            // Include cookies with the request
            withCredentials: true,
          }
        );

        const data = response.data;
        if (data.refreshToken) {
          setRefreshTokenMessage(`Refresh Token: ${data.refreshToken}`);
        } else {
          setRefreshTokenMessage("No refresh token found");
        }
      } catch (error: unknown) {
        setRefreshTokenMessage(
          `Failed to fetch cookies: ${
            axios.isAxiosError(error) && error.response
              ? `${error.response.status} - ${error.response.statusText}`
              : error instanceof Error ? error.message : String(error)
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
