// ~/routes/_protected.tsx

import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router";
import { useSession } from "~/context/SessionContext";
import { IoMdClose } from "react-icons/io";
import { FaCreditCard, FaMobileAlt } from "react-icons/fa";
import { useUserDetails } from "~/hooks/useUserDetails";
import { usePaymentMethods } from "~/hooks/usePaymentMethods";
import { CenterSpinner } from "~/components/ui/spinner";

export const clientLoader = async () => {
  return null;
};

export default function ProtectedLayout() {
  const { inApp, initialized, isAuthenticated } = useSession();
  const navigate = useNavigate();

  const { data: userResp, isLoading: userLoading } = useUserDetails();
  const userId = userResp?.data?.user?.id as string | undefined;

  const { data: paymentMethods, isLoading: paymentsLoading } = usePaymentMethods(userId);

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

  if (!initialized || userLoading || paymentsLoading) {
    return <CenterSpinner className="min-h-screen" />;
  }

  if (!isAuthenticated) {
    return <CenterSpinner className="min-h-screen" />;
  }

  if (paymentMethods && paymentMethods.length === 0) {
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
        <div className="flex flex-col items-center justify-center min-h-screen bg-white px-5">
          <div className="flex gap-4 mb-6">
            <FaCreditCard className="text-6xl text-gray-400" />
            <FaMobileAlt className="text-6xl text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold mb-4 text-center">No Linked Payment Method</h2>
          <p className="text-gray-600 text-center mb-6 max-w-md">
            Download the app, link a payment method, and come back to complete checkout.
          </p>
        </div>
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