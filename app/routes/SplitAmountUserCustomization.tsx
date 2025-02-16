import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "@remix-run/react";
import { Toaster, toast } from "sonner";
import { IoIosArrowBack, IoIosClose } from "react-icons/io";
import { motion, AnimatePresence } from "framer-motion";
import FloatingLabelInputOverdraft from "~/compoments/FloatingLabelInputOverdraft";
import FloatingLabelInputWithInstant from "~/compoments/FloatingLabelInputWithInstant";
import PaymentMethodItem from "~/compoments/PaymentMethodItem";
import ProtectedRoute from "~/compoments/ProtectedRoute";
import { usePaymentMethods, PaymentMethod } from "~/hooks/usePaymentMethods";
import { useUserDetails } from "~/hooks/useUserDetails";
import { useSession } from "~/context/SessionContext";
import { useCheckoutDetail } from "~/hooks/useCheckoutDetail";

// Define the shape of the passed data
interface SplitAmount {
  userId: string;
  amount: string;
}

interface LocationState {
  userAmounts: SplitAmount[];
  // Optional field for the type: "instantaneous" or "yearly"
  type?: "instantaneous" | "yearly";
}

// Define the structure of supercharge details
interface SuperchargeDetail {
  amount: string; // amount in cents as string
  paymentMethodId: string;
}

const SplitAmountUserCustomization: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Extract userAmounts and type from location.state
  const { userAmounts, type } = (location.state as LocationState) || { userAmounts: [] };
  const userAmountsArray = Array.isArray(userAmounts) ? userAmounts : [];
  console.log("userAmounts", userAmountsArray, "type:", type);

  // Redirect back if no user amounts are provided
  useEffect(() => {
    if (userAmountsArray.length === 0) {
      toast.error("No user amounts provided.");
      navigate(-1);
    }
  }, [userAmountsArray, navigate]);

  if (userAmountsArray.length === 0) {
    return null;
  }

  // Assume the first entry is for the current user
  const currentUserSplit = userAmountsArray[0];

  // Fetch current user details
  const {
    data: userData,
    isLoading: isUserLoading,
    isError: isUserError,
    error: userError,
  } = useUserDetails();

  // Get checkout details if needed
  const checkoutToken =
    typeof window !== "undefined" ? sessionStorage.getItem("checkoutToken") || "" : "";
  const {
    data: checkoutData,
    isLoading: checkoutLoading,
    isError: isCheckoutError,
    error: checkoutError,
  } = useCheckoutDetail(checkoutToken);

  // Get access token from Context
  const { accessToken } = useSession();

  // Fetch payment methods
  const {
    data: paymentData,
    isLoading: paymentLoading,
    isError: isPaymentError,
    error: paymentError,
  } = usePaymentMethods();

  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethod | null>(null);

  // Payment amount state (for split customization)
  const [paymentAmount, setPaymentAmount] = useState<string>("0.00");
  // Additional supercharge fields (optional)
  const [additionalFields, setAdditionalFields] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Determine if this is a yearly payment based on type passed in location state
  const isYearly = type === "yearly";

  // Based on payment type, set available power from user details
  const availablePower = isYearly
    ? userData?.data?.user?.yearlyPower
    : userData?.data?.user?.instantaneousPower;

  // For yearly, prefill paymentAmount if still default
  useEffect(() => {
    if (isYearly && availablePower && paymentAmount === "0.00") {
      setPaymentAmount(availablePower.toString());
    }
  }, [isYearly, availablePower, paymentAmount]);

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
    paymentData?.data.data.filter((method: PaymentMethod) => method.type === "card") || [];

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

  // Calculate the total amount from paymentAmount and additionalFields
  const calculateTotalAmount = () => {
    const superchargeTotal = additionalFields.reduce(
      (acc, field) => acc + parseFloat(field || "0"),
      0
    );
    const payment = parseFloat(paymentAmount || "0");
    return payment + superchargeTotal;
  };

  const totalAmount = calculateTotalAmount();

  // Handle changes in the main payment amount field
  const handlePaymentAmountChange = (value: string) => {
    const regex = /^\d+(\.\d{0,2})?$/;
    if (regex.test(value) || value === "") {
      setPaymentAmount(value);
    }
  };

  // Navigate to the next page
  const navigateToSplitPlans = () => {
    const total = calculateTotalAmount();
    if (Math.abs(total - userTotalAmount) > 0.01) {
      toast.error(`Total amount must equal your total amount of $${userTotalAmount.toFixed(2)}.`);
      return;
    }
    const paymentParsed = parseFloat(paymentAmount) || 0;
    if (paymentParsed < 0) {
      toast.error("Payment amount cannot be negative.");
      return;
    }
    for (let i = 0; i < additionalFields.length; i++) {
      const fieldAmount = parseFloat(additionalFields[i] || "0");
      if (isNaN(fieldAmount) || fieldAmount < 0) {
        toast.error(`Supercharge Amount ${i + 1} is invalid.`);
        return;
      }
    }

    // Prepare supercharge details (if any)
    const superchargeDetails: SuperchargeDetail[] = additionalFields
      .map((field) => ({
        amount: paymentAmountParsedToCents(field),
        paymentMethodId: selectedPaymentMethod?.id || "",
      }))
      .filter((detail) => detail.amount !== "0" && detail.paymentMethodId);

    // Build query parameters—use different key names based on type
    const paramsObj: Record<string, string> = {
      [isYearly ? "yearlyPowerAmount" : "instantPowerAmount"]: paymentAmountParsedToCents(paymentAmount),
      superchargeDetails: JSON.stringify(superchargeDetails),
      otherUserAmounts: JSON.stringify(userAmountsArray),
      paymentMethodId: selectedPaymentMethod?.id || "",
    };
    const params = new URLSearchParams(paramsObj).toString();
    console.log("params", { params });

    if (isYearly) {
      navigate(`/yearly-payment-plan?${params}`);
    } else {
      navigate(`/plans?${params}`);
    }
  };

  // Helper: convert dollars to cents as string
  const paymentAmountParsedToCents = (amount: string): string => {
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed < 0) return "0";
    return Math.round(parsed * 100).toString();
  };

  // Add a new Supercharge field (optional)
  const addField = () => {
    setAdditionalFields([...additionalFields, "0.00"]);
  };

  // Update a specific Supercharge field
  const updateField = (index: number, value: string) => {
    const regex = /^\d+(\.\d{0,2})?$/;
    if (regex.test(value) || value === "") {
      setAdditionalFields((prev) => {
        const updated = [...prev];
        updated[index] = value;
        return updated;
      });
    }
  };

  // Modal functions
  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isModalOpen) closeModal();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isModalOpen]);

  useEffect(() => {
    document.body.style.overflow = isModalOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isModalOpen]);

  const isLoading = isUserLoading || paymentLoading || checkoutLoading;
  const isErrorState =
    isUserError || isPaymentError || isCheckoutError || !userData?.data;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="loader"></div>
      </div>
    );
  }
  if (isErrorState) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <p className="text-red-500">
          {userError?.message ||
            paymentError?.message ||
            checkoutError?.message ||
            "Failed to load data."}
        </p>
      </div>
    );
  }

  const inputLabel = isYearly ? "Yearly Power Amount" : "Instant Power Amount";

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-xl mx-auto">
        {/* Header Section */}
        <header className="mb-6 flex items-center">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-gray-700 hover:text-gray-900"
          >
            <IoIosArrowBack className="mr-2" size={24} />
            Back
          </button>
        </header>

        {/* Header Text with current user's total amount */}
        <h1 className="text-2xl font-bold mb-4">
          Customize Your Amount: ${currentUserSplit.amount}
        </h1>

        {/* Payment Amount Input */}
        <FloatingLabelInputWithInstant
          label={inputLabel}
          value={paymentAmount}
          onChangeText={handlePaymentAmountChange}
          instantPower={availablePower}
          powerType={isYearly ? "yearly" : "instantaneous"}
        />

        {/* Spacer */}
        <div className="mt-4"></div>

        {/* Optional Additional Supercharge Fields */}
        {additionalFields.map((field, index) => (
          <div key={index} className="mb-4">
            <FloatingLabelInputOverdraft
              label={`Supercharge Amount ${index + 1}`}
              value={field}
              onChangeText={(value) => updateField(index, value)}
              selectedMethod={selectedPaymentMethod}
              onPaymentMethodPress={openModal}
            />
          </div>
        ))}

        {/* Buttons */}
        <div className="flex space-x-4 mb-4 mt-6">
          <button
            onClick={addField}
            className="flex-1 bg-white border border-gray-300 text-black text-base font-bold py-2 px-4 rounded-lg hover:bg-gray-50 transition"
          >
            Supercharge
          </button>
          <button
            onClick={navigateToSplitPlans}
            className={`flex-1 bg-black text-white py-4 px-4 rounded-lg text-base font-bold hover:bg-gray-800 transition ${
              totalAmount === userTotalAmount ? "" : "opacity-50 cursor-not-allowed"
            }`}
            disabled={totalAmount !== userTotalAmount}
          >
            {paymentAmount
              ? `Flex $${parseFloat(paymentAmount).toFixed(2)}`
              : "Flex"}
          </button>
        </div>

        {/* Payment Method Modal */}
        <AnimatePresence>
          {isModalOpen && (
            <>
              <motion.div
                className="fixed inset-0 bg-black bg-opacity-50 z-40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                onClick={closeModal}
              ></motion.div>
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
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex justify-end p-4">
                    <button
                      onClick={() => navigate("/payment-settings")}
                      className="bg-black text-white font-bold py-2 px-4 rounded-lg"
                    >
                      Payment Settings
                    </button>
                  </div>
                  <h2 className="text-xl font-semibold mb-4 px-4">
                    Select Payment Method
                  </h2>
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
                  </div>
                </motion.div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
      <Toaster richColors position="top-right" />
    </div>
  );
};

const SplitAmountPage: React.FC = () => {
  return (
    <ProtectedRoute>
      <SplitAmountUserCustomization />
    </ProtectedRoute>
  );
};

export default SplitAmountPage;
