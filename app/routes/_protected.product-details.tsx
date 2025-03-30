import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IoIosArrowBack } from 'react-icons/io';
import { useMonitoredProduct } from '../hooks/useMonitoredProduct';
import { useMonitorProduct } from '../hooks/useMonitorProduct';

const ProductDetailsPage: React.FC = () => {
  const navigate = useNavigate();

  // Retrieve the product id from sessionStorage (ensure this code only runs in the browser)
  const productId =
    typeof window !== 'undefined' ? sessionStorage.getItem('productId') || '' : '';
  console.log("productId", productId);

  // Fetch product details using the custom hook
  const {
    data: productResponse,
    error: productError,
    isLoading: productLoading,
  } = useMonitoredProduct(productId);

  // Prepare the mutation hook for monitoring the product
  const monitorMutation = useMonitorProduct();

  // Display a loading spinner if the request is still in progress
  if (productLoading) {
    return (
      <div className="flex items-start justify-start min-h-screen p-4">
        <svg
          className="animate-spin h-10 w-10 text-black"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          ></path>
        </svg>
      </div>
    );
  }

  // Handle potential errors for product details
  if (productError) {
    return (
      <div className="flex items-start justify-start min-h-screen p-4">
        <p className="text-xl text-red-500">
          Error loading product details: {productError.message}
        </p>
      </div>
    );
  }

  // Extract product details from the response
  const product = productResponse?.data;
  if (!product) {
    return (
      <div className="flex items-start justify-start min-h-screen p-4">
        <p className="text-xl">No product details available.</p>
      </div>
    );
  }

  const handleMonitorClick = () => {
    monitorMutation.mutate(productId, {
      onSuccess: (data) => {
        console.log("Product monitoring successful:", data);
        const targetWindow = window.opener || window.parent || window;
        targetWindow.postMessage(
          {
            status: "COMPLETED",
            monitoredProductId: data.productId,
            data,
          },
          "*"
        );
      },
      onError: (error: Error) => {
        console.error("Error monitoring product:", error);
        const targetWindow = window.opener || window.parent || window;
        targetWindow.postMessage(
          {
            status: "FAILED",
            error: error.message,
            data: null,
          },
          "*"
        );
      },
    });
  };

  return (
    <div className="min-h-screen font-sans p-4">
      <div className="container mx-auto">
        {/* Header Section */}
        <header className="mb-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-gray-700 hover:text-gray-900"
          >
            <IoIosArrowBack className="mr-2" size={24} />
            Back
          </button>
          <h1 className="text-2xl font-bold mt-2">Product Details</h1>
        </header>

        {/* Row container for image on the left and details on the right */}
        <div className="flex flex-row items-start gap-2">
          {/* Image Section on the Left */}
          <div className="p-2">
            <img
              src={product.productImageUrl}
              alt={product.productName}
              className="w-48 h-48 object-cover rounded-lg shadow-lg"
            />
          </div>
          {/* Details Section on the Right */}
          <div className="p-2 flex-1">
            <h2 className="text-2xl font-bold mb-2">
              <strong>Product Name: </strong>{product.productName}
            </h2>
            <p className="mb-2 text-xl">
              <strong>Price: </strong>${product.price.amount}
            </p>
            <p className="mb-2 text-xl">
              <strong>Quantity Left in Stock: </strong>{product.unitsInStock}
            </p>
          </div>
        </div>

        {/* Lower full-width Monitor Button */}
        <div className="mt-6">
          <button
            onClick={handleMonitorClick}
            disabled={monitorMutation.isPending}
            className="w-full bg-black text-white py-2 px-4 rounded font-bold"
          >
            {monitorMutation.isPending ? "Monitoring..." : "Monitor this product"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailsPage;
