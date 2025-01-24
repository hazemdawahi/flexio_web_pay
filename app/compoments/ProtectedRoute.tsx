// src/components/ProtectedRoute.tsx

import React from "react";
import { Navigate } from "@remix-run/react";
import { useSession } from "~/context/SessionContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { accessToken } = useSession();

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
