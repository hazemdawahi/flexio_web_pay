// File: src/pages/ProductDetailsPage.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IoIosArrowBack } from 'react-icons/io';
import { useMonitoredProduct } from '../hooks/useMonitoredProduct';
import { useMonitorProduct } from '../hooks/useMonitorProduct';
import { useIsProductMonitored } from '../hooks/useIsProductMonitored';

const ProductDetailsPage: React.FC = () => {
  const navigate = useNavigate();

  const productId =
    typeof window !== 'undefined' ? sessionStorage.getItem('productId') || '' : '';
  console.log("productId", productId);

  const {
    data: productResponse,
    error: productError,
    isLoading: productLoading,
  } = useMonitoredProduct(productId);

  const {
    data: isMonitoredResponse,
    isLoading: isMonitoredLoading,
    refetch: refetchIsMonitored,
  } = useIsProductMonitored(productId);

  const monitorMutation = useMonitorProduct();

  if (productLoading || isMonitoredLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 sm:p-6">
        <svg
          className="h-10 w-10 animate-spin text-black"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-label="Loading"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
        </svg>
      </div>
    );
  }

  if (productError) {
    return (
      <div className="flex min-h-screen items-start justify-start p-4 sm:p-6">
        <p className="text-base sm:text-lg md:text-xl text-red-500">
          Error loading product details: {productError.message}
        </p>
      </div>
    );
  }

  const product = productResponse?.data;
  if (!product) {
    return (
      <div className="flex min-h-screen items-start justify-start p-4 sm:p-6">
        <p className="text-base sm:text-lg md:text-xl">No product details available.</p>
      </div>
    );
  }

  const isAlreadyMonitored = !!isMonitoredResponse?.data?.monitored;

  const handleMonitorClick = () => {
    if (!productId || isAlreadyMonitored) return;

    monitorMutation.mutate(productId, {
      onSuccess: (data) => {
        console.log("Product monitoring successful:", data);

        // ❗️Do NOT postMessage here. Let SuccessMonitor show animation first,
        // then it will broadcast after its delay.
        refetchIsMonitored();

        const monitoredId = encodeURIComponent(data?.productId ?? productId);
        navigate(
          `/SuccessMonitor?status=COMPLETED&ms=3500&replace_to_index=1&monitoredProductId=${monitoredId}`,
          { replace: true }
        );
      },
      onError: (error: Error) => {
        console.error("Error monitoring product:", error);
        // No postMessage, no navigation on failure per your requirement.
      },
    });
  };

  return (
    <div className="min-h-screen font-sans p-4 sm:p-6">
      <div className="mx-auto w-full max-w-screen-lg">
        {/* Header Section */}
        <header className="mb-4 sm:mb-6">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center rounded px-2 py-1 text-gray-700 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/10"
            aria-label="Go back"
          >
            <IoIosArrowBack className="mr-2" size={22} />
            <span className="text-sm sm:text-base">Back</span>
          </button>
          <h1 className="mt-2 text-xl font-bold sm:text-2xl">Product Details</h1>
        </header>

        {/* Row container for image on the left and details on the right */}
        <div className="flex flex-col items-start gap-4 sm:gap-6 md:flex-row">
          {/* Image Section on the Left */}
          <div className="w-full md:w-auto md:flex-shrink-0">
            <div className="rounded-lg border border-gray-100 bg-white p-2 shadow-sm">
              <img
                src={product.productImageUrl}
                alt={product.productName}
                className="mx-auto block h-auto w-full max-w-xs md:max-w-sm md:w-64 md:h-64 object-cover rounded-md"
              />
            </div>
          </div>

          {/* Details Section on the Right */}
          <div className="w-full p-1 md:p-2">
            <h2 className="mb-2 text-lg font-bold sm:text-xl md:text-2xl">
              <strong>Product Name: </strong>{product.productName}
            </h2>
            <p className="mb-2 text-base sm:text-lg md:text-xl">
              <strong>Price: </strong>${product.price.amount}
            </p>
            <p className="mb-2 text-base sm:text-lg md:text-xl">
              <strong>Quantity Left in Stock: </strong>{product.unitsInStock}
            </p>
          </div>
        </div>

        {/* Lower full-width Monitor Button */}
        <div className="mt-6 sm:mt-8">
          <button
            onClick={handleMonitorClick}
            disabled={isAlreadyMonitored || monitorMutation.isPending || !productId}
            className="w-full rounded bg-black py-3 px-4 font-bold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isAlreadyMonitored
              ? "Already monitored"
              : monitorMutation.isPending
              ? "Monitoring..."
              : "Monitor this product"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailsPage;
