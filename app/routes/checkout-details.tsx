// src/routes/checkout-details.tsx

import React from "react";
import { useCheckoutDetail, CheckoutDetail } from "~/hooks/useCheckoutDetail";
import { useNavigate, useLocation } from "@remix-run/react";

const CheckoutDetails: React.FC = () => {
  // Log the user's browser information
  console.log(navigator.userAgent);

  // Extract state from navigation
  const location = useLocation();
  const source = (location.state as { source?: string })?.source || "";

  // Retrieve the token from sessionStorage
  const checkoutId = typeof window !== "undefined" ? sessionStorage.getItem("checkoutToken") || "" : "";

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

  // Destructure checkout details for easier access
  const {
    consumer,
    billing,
    shipping,
    courier,
    items,
    discounts,
    shippingAmount,
    taxAmount,
    description,
    merchant,
    redirectCheckoutUrl,
  } = data;

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white shadow-md rounded-lg font-sans">
      <h1 className="text-3xl font-bold mb-4">Checkout Details</h1>

      {/* Consumer Information */}
      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">Consumer Information</h2>
        <p><strong>Email:</strong> {consumer.email}</p>
        <p><strong>Name:</strong> {consumer.givenNames} {consumer.surname}</p>
        <p><strong>Phone Number:</strong> {consumer.phoneNumber}</p>
      </section>

      {/* Billing Information */}
      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">Billing Information</h2>
        <p><strong>Address Line 1:</strong> {billing.line1}</p>
        {billing.line2 && <p><strong>Address Line 2:</strong> {billing.line2}</p>}
        <p><strong>Area 1:</strong> {billing.area1}</p>
        <p><strong>Area 2:</strong> {billing.area2}</p>
        <p><strong>Region:</strong> {billing.region}</p>
        <p><strong>Postcode:</strong> {billing.postcode}</p>
        <p><strong>Country Code:</strong> {billing.countryCode}</p>
        <p><strong>Phone Number:</strong> {billing.phoneNumber}</p>
      </section>

      {/* Shipping Information */}
      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">Shipping Information</h2>
        <p><strong>Address Line 1:</strong> {shipping.line1}</p>
        {shipping.line2 && <p><strong>Address Line 2:</strong> {shipping.line2}</p>}
        <p><strong>Area 1:</strong> {shipping.area1}</p>
        <p><strong>Area 2:</strong> {shipping.area2}</p>
        <p><strong>Region:</strong> {shipping.region}</p>
        <p><strong>Postcode:</strong> {shipping.postcode}</p>
        <p><strong>Country Code:</strong> {shipping.countryCode}</p>
        <p><strong>Phone Number:</strong> {shipping.phoneNumber}</p>
      </section>

      {/* Courier Information */}
      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">Courier Information</h2>
        <p><strong>Name:</strong> {courier.name}</p>
        <p><strong>Tracking Number:</strong> {courier.tracking}</p>
        <p><strong>Priority:</strong> {courier.priority}</p>
        <p><strong>Shipped At:</strong> {new Date(courier.shippedAt).toLocaleString()}</p>
      </section>

      {/* Items */}
      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">Items</h2>
        <ul className="space-y-4">
          {items.map((item) => (
            <li key={item.id} className="border p-4 rounded">
              <p><strong>Name:</strong> {item.name}</p>
              <p><strong>SKU:</strong> {item.sku}</p>
              <p><strong>Quantity:</strong> {item.quantity}</p>
              <p><strong>Price:</strong> ${(item.price.amount / 100).toFixed(2)} {item.price.currency}</p>
              <p><strong>Estimated Shipment Date:</strong> {new Date(item.estimatedShipmentDate).toLocaleDateString()}</p>
              <a href={item.pageUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">View Product</a>
            </li>
          ))}
        </ul>
      </section>

      {/* Discounts */}
      {discounts.length > 0 && (
        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-2">Discounts</h2>
          <ul className="space-y-2">
            {discounts.map((discount) => (
              <li key={discount.id} className="border p-2 rounded">
                <p><strong>{discount.displayName}</strong>: -${(discount.amount.amount / 100).toFixed(2)} {discount.amount.currency}</p>
                <p>{discount.description}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Amounts */}
      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">Amounts</h2>
        <p><strong>Shipping Amount:</strong> ${(shippingAmount.amount / 100).toFixed(2)} {shippingAmount.currency}</p>
        <p><strong>Tax Amount:</strong> ${(taxAmount.amount / 100).toFixed(2)} {taxAmount.currency}</p>
        <p><strong>Description:</strong> {description}</p>
      </section>

      {/* Merchant Information */}
      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">Merchant Information</h2>
        <p><strong>Name:</strong> {merchant.name}</p>
        <p><strong>URL:</strong> <a href={merchant.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">{merchant.url}</a></p>
      </section>

      {/* Redirect Checkout URL */}
      {redirectCheckoutUrl && (
        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-2">Redirect Checkout</h2>
          <a href={redirectCheckoutUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
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
