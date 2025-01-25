// src/routes/merchant-shopping.tsx

import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "@remix-run/react";
import { PaymentMethod, usePaymentMethods } from "~/hooks/usePaymentMethods";
import { useUserDetails } from "~/hooks/useUserDetails";
import { useMerchantDetail } from "~/hooks/useMerchantDetail";
import { useSession } from "~/context/SessionContext";
import { IoIosArrowBack, IoIosClose } from "react-icons/io";
import { motion, AnimatePresence } from "framer-motion";
import FloatingLabelInputOverdraft from "~/compoments/FloatingLabelInputOverdraft";
import FloatingLabelInputWithInstant from "~/compoments/FloatingLabelInputWithInstant";
import PaymentMethodItem from "~/compoments/PaymentMethodItem";
import ProtectedRoute from "~/compoments/ProtectedRoute";

const MerchantShoppingContent: React.FC = () => {
  const [searchParams] = useSearchParams();
  const merchantId = searchParams.get("merchantId") || "";

  const [instantPowerAmount, setInstantPowerAmount] = useState("");
  const [additionalFields, setAdditionalFields] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const {
    data: paymentData,
    isLoading: paymentLoading,
    error: paymentError,
  } = usePaymentMethods();
  const [hasLinkedPaymentMethod, setHasLinkedPaymentMethod] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethod | null>(null);

  const {
    data: merchantData,
    isLoading: isMerchantLoading,
    error: merchantError,
  } = useMerchantDetail(merchantId);
  const {
    data: userData,
    isLoading: isUserLoading,
    error: userError,
  } = useUserDetails();
  const navigate = useNavigate();

  // Access the access token and inApp flag from Context
  const { accessToken, setAccessToken } = useSession();

  useEffect(() => {
    // Retrieve the token from sessionStorage or any other secure storage
    const storedToken = sessionStorage.getItem("accessToken");
    const storedInApp = sessionStorage.getItem("inApp");

    if (storedToken && !accessToken) {
      setAccessToken(storedToken);
    } else if (!storedToken) {
      console.warn("No access token found. Please log in.");
      // Redirect to login if no token
      navigate("/login");
    }

    if (storedInApp !== null) {
      console.log("inApp value from sessionStorage:", storedInApp);
      // Optionally, you can set the inApp state here if you have a setter
      // setInApp(storedInApp === "true");
    }
  }, [accessToken, setAccessToken, navigate]);

  const addField = () => {
    setAdditionalFields((prevFields) => [...prevFields, ""]);
  };

  const updateField = (index: number, value: string) => {
    setAdditionalFields((prevFields) => {
      const updatedFields = [...prevFields];
      updatedFields[index] = value;
      return updatedFields;
    });
  };

  useEffect(() => {
    const cardPaymentMethods = paymentData?.data.data.filter(
      (method: PaymentMethod) => method.type === "card"
    );
    setHasLinkedPaymentMethod(!!(
      cardPaymentMethods && cardPaymentMethods.length > 0
    ));
  }, [paymentData]);

  useEffect(() => {
    if (paymentData?.data.data.length && !selectedPaymentMethod) {
      const defaultCard = paymentData.data.data.find(
        (method: PaymentMethod) => method.type === "card"
      );
      setSelectedPaymentMethod(defaultCard || null);
    }
  }, [paymentData, selectedPaymentMethod]);

  const handleMethodSelect = useCallback((method: PaymentMethod) => {
    setSelectedPaymentMethod(method);
    closeModal();
  }, []);

  const calculateTotalAmount = () => {
    const superchargeTotal = additionalFields.reduce(
      (acc, field) => acc + parseFloat(field || "0"),
      0
    );
    return parseFloat(instantPowerAmount || "0") + superchargeTotal;
  };

  const totalAmount = calculateTotalAmount();

  const convertToCents = (amountStr: string): string => {
    const amount = parseFloat(amountStr);
    if (isNaN(amount)) return "0";
    return Math.round(amount * 100).toString();
  };

  const navigateToPlansPage = () => {
    const superchargeDetails = additionalFields.map((field, index) => ({
      amount: convertToCents(field), // Convert supercharge amount to cents
      paymentMethodId: selectedPaymentMethod?.id,
    }));

    if (!userData?.data?.user?.settings) {
      alert("Error: User settings not available.");
      return;
    }

    const smartPay = userData.data.user.smartPay;

    const totalAmountCents = convertToCents(totalAmount.toString());
    const instantPowerAmountCents = convertToCents(instantPowerAmount);

    const params = new URLSearchParams({
      merchantId,
      amount: totalAmountCents,
      instantPowerAmount: instantPowerAmountCents,
      superchargeDetails: JSON.stringify(superchargeDetails),
      paymentMethodId: selectedPaymentMethod?.id || "",
    }).toString();

    // Navigate to /plans with query parameters
    navigate(`/plans?${params}`);
  };

  const openModal = () => {
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  // Close modal on Esc key press
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isModalOpen) {
        closeModal();
      }
    };

    window.addEventListener("keydown", handleEsc);

    return () => {
      window.removeEventListener("keydown", handleEsc);
    };
  }, [isModalOpen]);

  // Prevent scrolling when modal is open
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isModalOpen]);

  // Loading state
  if (isMerchantLoading || isUserLoading || paymentLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="loader"></div>
      </div>
    );
  }

  // Error state
  if (userError || paymentError || !userData?.data) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-red-500">
          {userError?.message ||
            paymentError?.message ||
            "Failed to load data."}
        </p>
      </div>
    );
  }

  const cardPaymentMethods =
    paymentData?.data.data.filter(
      (method: PaymentMethod) => method.type === "card"
    ) || [];

  return (
    <div className="min-h-screen bg-white p-4">
      <div className="max-w-xl mx-auto">
        {/* Header Section */}
        <header className="mb-6 flex items-center">
          {/* Back Button */}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-gray-700 hover:text-gray-900"
          >
            <IoIosArrowBack className="mr-2" size={24} />
            Back
          </button>
        </header>

        {/* "How much would you like to spend?" Header */}
        <h1 className="text-2xl font-bold mb-4">
          How much would you like to spend?
        </h1>

        {/* Instant Power Amount Input */}
        <FloatingLabelInputWithInstant
          label="Instant Power Amount"
          value={instantPowerAmount}
          onChangeText={setInstantPowerAmount}
          keyboardType="number"
          instantPower={userData.data.user.instantaneousPower}
        />

        {/* Spacer between Instant Power and Supercharge Fields */}
        <div className="mt-4"></div>

        {/* Additional Supercharge Fields */}
        {additionalFields.map((field, index) => (
          <div key={index} className="mb-4">
            <FloatingLabelInputOverdraft
              label="Supercharge Amount"
              value={field}
              onChangeText={(value) => updateField(index, value)}
              keyboardType="number"
              selectedMethod={selectedPaymentMethod}
              onPaymentMethodPress={openModal}
            />
          </div>
        ))}

        {/* Buttons Container */}
        <div className="flex space-x-4 mb-4">
          {/* Supercharge Button */}
          <button
            onClick={addField}
            className="flex-1 bg-white border border-gray-300 text-black text-base font-bold py-2 px-4 rounded-lg hover:bg-gray-50 transition"
          >
            Supercharge
          </button>

          {/* Continue Button */}
          <button
            onClick={navigateToPlansPage}
            className="flex-1 bg-black text-white py-4 px-4 rounded-lg text-base font-bold hover:bg-gray-800 transition"
          >
            {totalAmount > 0 ? `Flex $${totalAmount}` : "Flex your payments"}
          </button>
        </div>

        {/* Payment Method Modal */}
        <AnimatePresence>
          {isModalOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                className="fixed inset-0 bg-black bg-opacity-50 z-40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                onClick={closeModal} // Close modal when clicking on the backdrop
              ></motion.div>

              {/* Modal */}
              <motion.div
                className="fixed inset-x-0 bottom-0 z-50 flex justify-center items-end sm:items-center"
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "100%", opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <motion.div
                  className="w-full sm:max-w-md bg-white rounded-t-lg sm:rounded-lg shadow-lg max-h-3/4 overflow-y-auto"
                  initial={{ y: "100%", opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: "100%", opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the modal
                >
                  {/* Modal Header with Enlarged Close Icon */}
                  <div className="flex justify-end p-4">
                    <button
                      onClick={closeModal}
                      className="text-gray-500 hover:text-gray-700 focus:outline-none"
                    >
                      <IoIosClose size={36} /> {/* Increased size from 24 to 36 */}
                    </button>
                  </div>

                  {/* Modal Title */}
                  <h2 className="text-xl font-semibold mb-4 px-4">
                    Select Payment Method
                  </h2>

                  {/* Payment Methods List */}
                  <div className="space-y-4 px-4 pb-4">
                    {cardPaymentMethods.map((method, index) => (
                      <PaymentMethodItem
                        key={method.id}
                        method={method}
                        selectedMethod={selectedPaymentMethod}
                        onSelect={handleMethodSelect}
                        isLastItem={index === cardPaymentMethods.length - 1}
                      />
                    ))}

                    {/* Optionally, you can add a button to add a new payment method */}
                    {/* <button
                      onClick={() => navigate("/add-payment-method")}
                      className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition"
                    >
                      Add New Payment Method
                    </button> */}
                  </div>
                </motion.div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// Wrap the MerchantShoppingContent with ProtectedRoute
const MerchantShopping: React.FC = () => {
  return (
    <ProtectedRoute>
      <MerchantShoppingContent />
    </ProtectedRoute>
  );
};

export default MerchantShopping;
