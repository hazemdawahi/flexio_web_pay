// ~/routes/_protected.tsx

import React, { useEffect } from "react";
import { Outlet, useNavigate } from "@remix-run/react";
import { useSession } from "~/context/SessionContext";
import { IoMdClose } from "react-icons/io";
import { useUserDetails } from "~/hooks/useUserDetails";

export const clientLoader = async () => {
  return null;
};

export default function ProtectedLayout() {
  const { inApp, initialized, isAuthenticated } = useSession();
  const navigate = useNavigate();

  // This hook makes an authenticated API call on mount
  // If token is expired, it will trigger auth:error event
  const { isLoading: userLoading, isError: userError } = useUserDetails();

  useEffect(() => {
    if (initialized && !isAuthenticated) {
      navigate("/login", { replace: true });
    }
  }, [initialized, isAuthenticated, navigate]);

  const handleClose = () => {
    const targetWindow =
      window.parent !== window
        ? window.parent
        : window.opener
        ? window.opener
        : window;

    targetWindow.postMessage(
      {
        status: "FAILED",
        error: "Payment canceled or closed before completion.",
      },
      "*"
    );
  };

  if (!initialized || userLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <p className="text-xl text-gray-700">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <p className="text-xl text-gray-700">Redirecting...</p>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
      {inApp && (
        <button
          onClick={handleClose}
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: "24px",
            zIndex: 50,
          }}
          aria-label="Close"
        >
          <IoMdClose />
        </button>
      )}
      <Outlet />
    </div>
  );
}