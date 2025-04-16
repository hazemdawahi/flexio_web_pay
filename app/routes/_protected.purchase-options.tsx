// src/routes/checkout-options.tsx (or the appropriate file name)
import React, { useEffect, useState } from "react";
import { HiOutlineShoppingCart, HiOutlineUsers, HiOutlineEye } from "react-icons/hi";
import { useNavigate } from "@remix-run/react";
import { useCheckoutDetail } from "~/hooks/useCheckoutDetail";

const PurchaseOptionsContent: React.FC = () => {
  const navigate = useNavigate();
  const [inApp, setInApp] = useState<boolean>(false);
  const [hasToken, setHasToken] = useState<boolean>(false);

  // Retrieve token and productId from sessionStorage and call checkout hook if token exists.
  const checkoutToken =
    typeof window !== "undefined" ? sessionStorage.getItem("checkoutToken") || "" : "";
  
  const { data, isLoading, error } = useCheckoutDetail(checkoutToken);

  useEffect(() => {
    // Check if the app is running in-app
    const inAppValue = sessionStorage.getItem("inApp");
    setInApp(inAppValue === "true");

    // Check if a valid (non-empty) token exists in sessionStorage
    const token = sessionStorage.getItem("checkoutToken");
    if (token && token.trim() !== "") {
      setHasToken(true);
    } else {
      setHasToken(false);
    }
  }, []);

  // Determine whether split purchase is enabled via configuration from the checkout details
  const isSplitEnabled = data?.configuration?.enableSplitPay;

  return (
    <div className="min-h-screen flex flex-col items-center bg-white p-4">
      {/* Header */}
      <header className="w-full max-w-3xl text-left mb-8">
        <h1 className="text-3xl font-bold">What do you want to do?</h1>
      </header>

      {hasToken ? (
        <>
          {/* Container for Complete Checkout */}
          <div
            onClick={() => navigate("/power-options")}
            className="w-full max-w-3xl bg-white shadow-md rounded-2xl p-8 mb-6 flex items-center cursor-pointer hover:shadow-lg transition"
          >
            <HiOutlineShoppingCart className="text-gray-700 text-4xl mr-6" />
            <div>
              <h2 className="text-2xl font-bold mb-2">Complete Checkout</h2>
              <p className="text-gray-600">
                Finalize your purchase and proceed to the merchant's shopping page.
              </p>
            </div>
          </div>

          {/* Conditionally render container for Split Purchase if enabled in configuration */}
          {isSplitEnabled && !isLoading && !error && (
            <div
              onClick={() => navigate("/split-purchase")}
              className="w-full max-w-3xl bg-white shadow-md rounded-2xl p-8 mb-6 flex items-center cursor-pointer hover:shadow-lg transition"
            >
              <HiOutlineUsers className="text-gray-700 text-4xl mr-6" />
              <div>
                <h2 className="text-2xl font-bold mb-2">Split Purchase</h2>
                <p className="text-gray-600">
                  Share the cost with others for more flexible payments.
                </p>
              </div>
            </div>
          )}
        </>
      ) : (
        // If no valid token, show the Monitor Product option with an appropriate icon
        <div
          onClick={() => navigate("/product-details")}
          className="w-full max-w-3xl bg-white shadow-md rounded-2xl p-8 mb-6 flex items-center cursor-pointer hover:shadow-lg transition"
        >
          <HiOutlineEye className="text-gray-700 text-4xl mr-6" />
          <div>
            <h2 className="text-2xl font-bold mb-2">Monitor Product</h2>
            <p className="text-gray-600">
              Keep an eye on product details and get notified when available.
            </p>
          </div>
        </div>
      )}

      {/* Sign Out Button (conditionally rendered) */}
      {!inApp && (
        <button className="bg-black text-white font-bold py-4 px-16 rounded-lg mt-8 hover:opacity-80 transition w-full max-w-3xl">
          Sign Out
        </button>
      )}
    </div>
  );
};

export default PurchaseOptionsContent;
