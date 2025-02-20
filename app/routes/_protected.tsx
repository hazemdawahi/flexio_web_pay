import React from "react";
import { Outlet } from "@remix-run/react";
import SessionProvider from "~/provider/sessionProvider";
import ProtectedRoute from "~/compoments/ProtectedRoute";
import { useSession } from "~/context/SessionContext";
import { IoMdClose } from "react-icons/io";

function ProtectedContent() {
  const { inApp } = useSession();

  const handleClose = () => {
    console.log("ProtectedContent => handleClose => sending FAILED");

    // Because we're inside an iframe for the bottom-sheet scenario,
    // we want to postMessage to the *parent* window if possible.
    // Fallback to same window if not in an iframe.
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

  return (
    <ProtectedRoute>
      <div style={{ position: "relative" }}>
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
            }}
            aria-label="Close"
          >
            <IoMdClose />
          </button>
        )}
        <Outlet />
      </div>
    </ProtectedRoute>
  );
}

export default function ProtectedLayout() {
  return (
    <SessionProvider>
      <ProtectedContent />
    </SessionProvider>
  );
}
