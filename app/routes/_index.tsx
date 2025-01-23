import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "@remix-run/react"; 

export default function RootRoute() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    async function refreshAuth() {
      try {
        const response = await axios.get(
          "https://modern-sites-suffer.loca.lt/api/user/refresh",  
          {
            headers: {
              Accept: "application/json",
            },
            withCredentials: true, // Ensure cookies are sent with the request
          }
        );

        const responseData = response.data;
        console.log("response.data",response.data)
        setData(responseData);

        if (responseData.success && responseData.data?.accessToken) {
          // If access token is returned, redirect to the plan page
          navigate("/plan");
        } else {
          // If no valid token, redirect to login
          navigate("/login");
        }
      } catch (error) {
        // On error (e.g., network issues, invalid token), redirect to login
        navigate("/login");
      }
    }

    refreshAuth();
  }, [navigate]);

  return (
    <div className="flex flex-col items-center p-4 font-sans">
      <pre>data: {JSON.stringify(data, null, 2)}</pre>
      <h1 className="text-2xl font-bold">Authenticating...</h1>
      <div className="mt-4 text-4xl animate-spin">🔄</div>
    </div>
  );
}
