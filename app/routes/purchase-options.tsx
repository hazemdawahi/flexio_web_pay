import React, { useEffect, useState } from "react";
import { HiOutlineShoppingCart, HiOutlineUsers } from "react-icons/hi";
import { useNavigate } from "@remix-run/react";

export default function PurchaseOptions() {
  const navigate = useNavigate();
  const [inApp, setInApp] = useState<boolean>(false);

  // Check sessionStorage for "inApp" value
  useEffect(() => {
    const value = sessionStorage.getItem("inApp");
    setInApp(value === "true");
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center bg-white p-4">
      {/* Header */}
      <header className="w-full max-w-3xl text-left mb-8">
        <h1 className="text-3xl font-bold">What do you want to do?</h1>
      </header>

      {/* Container for Complete Checkout */}
      <div
        onClick={() => navigate("/merchant-shopping")}
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

      {/* Container for Split Purchase */}
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

      {/* Sign Out Button (conditionally rendered) */}
      {!inApp && (
        <button className="bg-black text-white font-bold py-4 px-16 rounded-lg mt-8 hover:opacity-80 transition w-full max-w-3xl">
          Sign Out
        </button>
      )}
    </div>
  );
}
