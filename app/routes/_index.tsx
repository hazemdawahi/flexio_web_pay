import React, { useEffect, useState } from "react";

export default function RootRoute() {
  const [cookies, setCookies] = useState("Loading...");

  useEffect(() => {
    async function fetchCookies() {
      try {
        const response = await fetch("https://romantic-walleye-moderately.ngrok-free.app/api/user/log-cookies");
        if (!response.ok) {
          throw new Error(`Error: ${response.status} - ${response.statusText}`);
        }
        const data = await response.json();
        setCookies(JSON.stringify(data, null, 2)); // Format the JSON data
      } catch (error: unknown) {
        setCookies(`Failed to fetch cookies: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    fetchCookies();
  }, []);

  return (
    <div style={styles.container}>
      <h1>All Cookies</h1>
      <pre style={styles.pre}>{cookies}</pre>
    </div>
  );
}

const styles = {
  container: { fontFamily: "sans-serif", padding: "1rem" },
  pre: { backgroundColor: "#f4f4f4", padding: "1rem", borderRadius: "5px" },
} as const;
