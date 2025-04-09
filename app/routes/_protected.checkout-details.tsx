// src/routes/checkout-details.tsx

import React from "react";
import { useCheckoutDetail } from "~/hooks/useCheckoutDetail";
import { useNavigate, useLocation } from "@remix-run/react";

const CheckoutDetails: React.FC = () => {
  // Log the user's browser information
  console.log(navigator.userAgent);

  // Extract state from navigation
  const location = useLocation();
  const source = (location.state as { source?: string })?.source || "";

  // Retrieve the checkout token from sessionStorage
  const checkoutId =
    typeof window !== "undefined" ? sessionStorage.getItem("checkoutToken") || "" : "";

  // Use the custom hook to fetch checkout details
  const { data, isLoading, error } = useCheckoutDetail(checkoutId);
  console.log("data", data);

  // Initialize navigation
  const navigate = useNavigate();

  // Handler for proceeding to purchase options
  const handleProceed = () => {
    navigate("/purchase-options", { replace: true, state: { source } });
  };

  // Render a loading state while fetching data
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 font-sans">
        <h1 className="text-2xl font-bold">Loading Checkout Details...</h1>
        <div className="mt-4 text-4xl animate-spin">🔄</div>
      </div>
    );
  }

  // Render an error state if fetching fails
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 font-sans">
        <h1 className="text-2xl font-bold">Error Loading Checkout Details</h1>
        <p className="mt-4 text-lg text-red-600">{error.message}</p>
      </div>
    );
  }

  // Handle cases where no data is returned
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 font-sans">
        <h1 className="text-2xl font-bold">No Checkout Details Found</h1>
        <p className="mt-4 text-lg">Please ensure you have a valid checkout session.</p>
      </div>
    );
  }

  // Destructure the checkout detail data from the nested 'checkout' property
  const {
    id,
    redirectCheckoutUrl,
    reference,
    sandbox,
    offsetStartDate,
    paymentFrequency,
    numberOfPayments,
    totalAmount,
    expires,
    createdAt,
    updatedAt,
  } = data.checkout;

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white shadow-md rounded-lg font-sans">
      <h1 className="text-3xl font-bold mb-4">Checkout Details</h1>

      {/* Order Information */}
      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">Order Information</h2>
        <p>
          <strong>Checkout ID:</strong> {id}
        </p>
        <p>
          <strong>Reference:</strong> {reference}
        </p>
        <p>
          <strong>Status:</strong> {status}
        </p>
        <p>
          <strong>Sandbox Mode:</strong> {sandbox ? "Yes" : "No"}
        </p>
      </section>

      {/* Payment Details */}
      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">Payment Details</h2>
        <p>
          <strong>Payment Frequency:</strong> {paymentFrequency}
        </p>
        <p>
          <strong>Number of Payments:</strong> {numberOfPayments}
        </p>
        <p>
          <strong>Total Amount:</strong>{" "}
          {(parseFloat(totalAmount.amount) / 100).toFixed(2)} {totalAmount.currency}
        </p>
      </section>

      {/* Timing Information */}
      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">Timing</h2>
        <p>
          <strong>Expires:</strong> {new Date(expires).toLocaleString()}
        </p>
        <p>
          <strong>Offset Start Date:</strong>{" "}
          {offsetStartDate ? new Date(offsetStartDate).toLocaleString() : "N/A"}
        </p>
        <p>
          <strong>Created At:</strong> {new Date(createdAt).toLocaleString()}
        </p>
        <p>
          <strong>Updated At:</strong> {new Date(updatedAt).toLocaleString()}
        </p>
      </section>

      {/* Redirect Checkout URL */}
      {redirectCheckoutUrl && (
        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-2">Redirect Checkout</h2>
          <a
            href={redirectCheckoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 underline"
          >
            Complete Your Purchase
          </a>
        </section>
      )}

      {/* Proceed Button */}
      <button
        onClick={handleProceed}
        className="mt-8 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition duration-300"
      >
        Proceed to Payment Options
      </button>
    </div>
  );
};

export default CheckoutDetails;
