// src/pages/SplitAmountUserCustomization.tsx

import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "@remix-run/react";
import { Toaster, toast } from "sonner";
import { IoIosArrowBack, IoIosClose } from "react-icons/io";
import { motion, AnimatePresence } from "framer-motion";
import FloatingLabelInputOverdraft from "~/compoments/FloatingLabelInputOverdraft"; // Corrected import path
import FloatingLabelInputWithInstant from "~/compoments/FloatingLabelInputWithInstant"; // Corrected import path
import PaymentMethodItem from "~/compoments/PaymentMethodItem"; // Corrected import path
import ProtectedRoute from "~/compoments/ProtectedRoute"; // Corrected import path
import { usePaymentMethods, PaymentMethod } from "~/hooks/usePaymentMethods";
import { useUserDetails } from "~/hooks/useUserDetails";
import { useSession } from "~/context/SessionContext";

// Define the shape of the passed data
interface SplitAmount {
  userId: string;
  amount: string;
}

interface LocationState {
  userAmounts: SplitAmount[];
}

const SplitAmountUserCustomization: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Extract userAmounts from location state
  const { userAmounts } = (location.state as LocationState) || { userAmounts: [] };
  const userAmountsArray = Array.isArray(userAmounts) ? userAmounts : [];
   console.log("userAmounts",userAmountsArray)


  // Retrieve the current user's split amount
  const currentUserSplit = userAmountsArray[0];

  // Fetch current user details without arguments
  const {
    data: userData,
    isLoading: isUserLoading,
    isError: isUserError,
    error: userError,
  } = useUserDetails(); // Removed userId argument

  // Access the access token from Context
  const { accessToken, setAccessToken } = useSession();

  // Fetch payment methods
  const {
    data: paymentData,
    isLoading: paymentLoading,
    isError: isPaymentError,
    error: paymentError,
  } = usePaymentMethods();

  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethod | null>(null);

  const [instantPowerAmount, setInstantPowerAmount] = useState<string>("0.00");
  const [additionalFields, setAdditionalFields] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Set userTotalAmount from currentUserSplit
  const [userTotalAmount, setUserTotalAmount] = useState<number>(0);

  useEffect(() => {
    if (currentUserSplit.amount) {
      const amt = parseFloat(currentUserSplit.amount);
      if (!isNaN(amt)) {
        setUserTotalAmount(amt);
      }
    }
  }, [currentUserSplit.amount]);

  // Filter card payment methods
  const cardPaymentMethods =
    paymentData?.data.data.filter((method: PaymentMethod) => method.type === "card") ||
    [];

  // Set default payment method if not selected
  useEffect(() => {
    if (cardPaymentMethods.length > 0 && !selectedPaymentMethod) {
      setSelectedPaymentMethod(cardPaymentMethods[0]);
    }
  }, [cardPaymentMethods, selectedPaymentMethod]);

  // Handle payment method selection
  const handleMethodSelect = useCallback((method: PaymentMethod) => {
    setSelectedPaymentMethod(method);
    closeModal();
  }, []);

  // Calculate the total amount from instantPowerAmount and additionalFields
  const calculateTotalAmount = () => {
    const superchargeTotal = additionalFields.reduce(
      (acc, field) => acc + parseFloat(field || "0"),
      0
    );
    const instantPower = parseFloat(instantPowerAmount || "0");
    return instantPower + superchargeTotal;
  };

  const totalAmount = calculateTotalAmount();

  // Convert amount string to cents string
  const convertToCents = (amountStr: string): string => {
    const amount = parseFloat(amountStr);
    if (isNaN(amount)) return "0";
    return Math.round(amount * 100).toString();
  };

  // Handle Instant Power Amount change
  const handleInstantPowerChange = (value: string) => {
    const newAmount = parseFloat(value) || 0;

    // Ensure the new amount is not negative and does not exceed the user's total amount
    if (newAmount < 0) {
      toast.error("Amount cannot be negative.");
      return;
    }

    const superchargeTotal = additionalFields.reduce(
      (acc, field) => acc + parseFloat(field || "0"),
      0
    );

    if (newAmount + superchargeTotal > userTotalAmount) {
      toast.error(
        `Total of Instant Power and Supercharge amounts cannot exceed your total amount of $${userTotalAmount.toFixed(
          2
        )}.`
      );
      return;
    }

    setInstantPowerAmount(newAmount.toFixed(2));
  };

  // Handle navigation to plans page
  const navigateToPlansPage = () => {
    // Calculate total amount
    const totalAmount = calculateTotalAmount();

    // Validate total amount
    if (Math.abs(totalAmount - userTotalAmount) > 0.01) {
      toast.error(
        `Total amount must equal your total amount of $${userTotalAmount.toFixed(2)}.`
      );
      return;
    }

    // Prepare supercharge details
    const superchargeDetails = additionalFields
      .map((field) => ({
        amount: convertToCents(field),
        paymentMethodId: selectedPaymentMethod?.id,
      }))
      .filter((detail) => detail.amount !== "0" && detail.paymentMethodId);

    const params = new URLSearchParams({
      amount: convertToCents(totalAmount.toString()),
      instantPowerAmount: convertToCents(instantPowerAmount),
      superchargeDetails: JSON.stringify(superchargeDetails),
      paymentMethodId: selectedPaymentMethod?.id || "",
    }).toString();

    // Navigate to /plans with query parameters
    navigate(`/plans?${params}`);
  };

  // Add a new Supercharge field
  const addField = () => {
    setAdditionalFields([...additionalFields, "0.00"]);
  };

  // Update a specific Supercharge field
  const updateField = (index: number, value: string) => {
    setAdditionalFields((prevFields) => {
      const updatedFields = [...prevFields];
      updatedFields[index] = value;
      return updatedFields;
    });

    // Validate total after update
    const newSuperchargeTotal = additionalFields.reduce(
      (acc, field, idx) => acc + (idx === index ? parseFloat(value || "0") : parseFloat(field || "0")),
      0
    );
    const newInstantPower = parseFloat(instantPowerAmount || "0");
    const newTotal = newSuperchargeTotal + newInstantPower;

    if (newTotal > userTotalAmount) {
      toast.error(
        `Total of Instant Power and Supercharge amounts cannot exceed your total amount of $${userTotalAmount.toFixed(
          2
        )}.`
      );
    }
  };

  // Open and close modal functions
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

  // Loading and Error states
  const isLoading = isUserLoading || paymentLoading;
  const isErrorState = isUserError || isPaymentError || !userData?.data;

  // Loading state UI
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="loader"></div>
      </div>
    );
  }

  // Error state UI
  if (isErrorState) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <p className="text-red-500">
          {userError?.message ||
            paymentError?.message ||
            "Failed to load data."}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-6">
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

        {/* Header Text with Current User's Total Amount */}
        <h1 className="text-2xl font-bold mb-4">
          Customize Your Amount: ${currentUserSplit.amount}
        </h1>

        {/* Instant Power Amount Input */}
        <FloatingLabelInputWithInstant
          label="Instant Power Amount"
          value={instantPowerAmount}
          onChangeText={handleInstantPowerChange}
          keyboardType="number"
          instantPower={userData.data?.user.instantaneousPower} // Assuming no default instantaneous power; adjust as needed
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
        <div className="flex space-x-4 mb-4 mt-6">
          {/* Supercharge Button */}
          <button
            onClick={addField}
            className="flex-1 bg-white border border-gray-300 text-black text-base font-bold py-2 px-4 rounded-lg hover:bg-gray-50 transition"
          >
            Supercharge
          </button>

          {/* Continue (Flex) Button */}
          <button
            onClick={navigateToPlansPage}
            className={`flex-1 bg-black text-white py-4 px-4 rounded-lg text-base font-bold hover:bg-gray-800 transition ${
              totalAmount === parseFloat(currentUserSplit.amount)
                ? ""
                : "opacity-50 cursor-not-allowed"
            }`}
            disabled={totalAmount !== parseFloat(currentUserSplit.amount)}
          >
            {instantPowerAmount
              ? `Flex $${parseFloat(instantPowerAmount).toFixed(2)}`
              : "Flex"}
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

                    {/* Optionally, add a button to add a new payment method */}
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

      {/* React Sonner Toaster */}
      <Toaster richColors position="top-right" />
    </div>
  );
};

// Wrap the SplitAmountUserCustomization with ProtectedRoute
const SplitAmountPage: React.FC = () => {
  return (
    <ProtectedRoute>
      <SplitAmountUserCustomization />
    </ProtectedRoute>
  );
};

export default SplitAmountPage;
