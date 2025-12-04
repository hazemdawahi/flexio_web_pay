// ~/compoments/ProtectedRoute.tsx

import React from "react";
import { Navigate, useLocation } from "@remix-run/react";
import { useSession } from "~/context/SessionContext";

const PUBLIC_ROUTES = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/",
]);

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, initialized } = useSession();
  const location = useLocation();

  // Show loading while session is initializing
  if (!initialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-xl">Loading...</p>
      </div>
    );
  }

  const isPublicRoute = PUBLIC_ROUTES.has(location.pathname);

  // If not authenticated and not on a public route, redirect to login
  if (!isAuthenticated && !isPublicRoute) {
    // Double-check sessionStorage in case context is stale
    const storedToken = typeof window !== "undefined" 
      ? sessionStorage.getItem("accessToken") 
      : null;
    
    if (!storedToken) {
      return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;