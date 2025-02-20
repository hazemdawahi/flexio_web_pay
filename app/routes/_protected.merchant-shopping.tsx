import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "@remix-run/react";
import { PaymentMethod, usePaymentMethods } from "~/hooks/usePaymentMethods";
import { useUserDetails } from "~/hooks/useUserDetails";
import { useSession } from "~/context/SessionContext";
import { IoIosArrowBack } from "react-icons/io";
import { motion, AnimatePresence } from "framer-motion";
import FloatingLabelInputOverdraft from "~/compoments/FloatingLabelInputOverdraft";
import FloatingLabelInputWithInstant from "~/compoments/FloatingLabelInputWithInstant";
import PaymentMethodItem from "~/compoments/PaymentMethodItem";
import ProtectedRoute from "~/compoments/ProtectedRoute";
import { useCheckoutDetail } from "~/hooks/useCheckoutDetail";
import { Toaster } from "sonner";

// Optional state interface: type can be passed via state (if needed)
interface LocationState {
  // Optionally, state can include a payment type ("instantaneous" or "yearly")
  type?: "instantaneous" | "yearly";
}

const MerchantShoppingContent: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Read payment type from state; default to "instantaneous" if not provided.
  const stateData = (location.state as LocationState) || {};
  const paymentType = stateData.type || "instantaneous";
  
  // Retrieve checkoutToken from sessionStorage
  const checkoutToken = sessionStorage.getItem("checkoutToken") || "";
  
  // Payment amount state (used for both instantaneous and yearly)
  const [paymentAmount, setPaymentAmount] = useState("");
  const [additionalFields, setAdditionalFields] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const {
    data: paymentData,
    isLoading: paymentLoading,
    isError: isPaymentError,
    error: paymentError,
  } = usePaymentMethods();
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  
  const {
    data: userData,
    isLoading: isUserLoading,
    isError: isUserError,
    error: userError,
  } = useUserDetails();
  const { accessToken } = useSession();
  
  const {
    data: checkoutData,
    isLoading: checkoutLoading,
    isError: isCheckoutError,
    error: checkoutError,
    status: checkoutStatus,
  } = useCheckoutDetail(checkoutToken);
  
  // Calculate the total checkout amount
  const checkoutTotalAmount = checkoutData
    ? parseFloat(checkoutData.checkout.totalAmount.amount)
    : 0;
  
  const addField = () => setAdditionalFields((prev) => [...prev, ""]);
  const updateField = (index: number, value: string) => {
    setAdditionalFields((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };
  
  useEffect(() => {
    const cardPaymentMethods = paymentData?.data.data.filter(
      (method: PaymentMethod) => method.type === "card"
    );
    if (cardPaymentMethods && cardPaymentMethods.length > 0 && !selectedPaymentMethod) {
      setSelectedPaymentMethod(cardPaymentMethods[0]);
    }
  }, [paymentData, selectedPaymentMethod]);
  
  // When paymentType is "yearly", prefill paymentAmount with available yearly power (if not set)
  const isYearly = paymentType === "yearly";
  const availablePower = isYearly
    ? userData?.data?.user?.yearlyPower
    : userData?.data?.user?.instantaneousPower;
  useEffect(() => {
    if (isYearly && availablePower && paymentAmount === "") {
      setPaymentAmount(availablePower.toString());
    }
  }, [isYearly, availablePower, paymentAmount]);
  
  const handleMethodSelect = useCallback((method: PaymentMethod) => {
    setSelectedPaymentMethod(method);
    closeModal();
  }, []);
  
  // Calculate total amount from paymentAmount and additional supercharge fields
  const calculateTotalAmount = () => {
    const superchargeTotal = additionalFields.reduce(
      (acc: number, field: string) => acc + parseFloat(field || "0"),
      0
    );
    const payment = parseFloat(paymentAmount || "0");
    return payment + superchargeTotal;
  };
  const totalAmount = calculateTotalAmount();
  
  const convertToCents = (amountStr: string): string => {
    const amount = parseFloat(amountStr);
    if (isNaN(amount)) return "0";
    return Math.round(amount * 100).toString();
  };
  
  // Instead of building query params, we pass the needed data via state
  const navigateToPlansPage = () => {
    const superchargeDetails = additionalFields.map((field: string) => ({
      amount: convertToCents(field),
      paymentMethodId: selectedPaymentMethod?.id,
    }));
  
    if (!userData?.data?.user?.settings) {
      alert("Error: User settings not available.");
      return;
    }
  
    const totalAmountCents = convertToCents(totalAmount.toString());
    const paymentAmountCents = convertToCents(paymentAmount);
  
    // Build an object to pass via state
    const stateData = {
      amount: totalAmountCents,
      superchargeDetails,
      paymentMethodId: selectedPaymentMethod?.id || "",
      paymentType, // "instantaneous" or "yearly"
      // Also pass the payment amount key based on type:
      [isYearly ? "yearlyPowerAmount" : "instantPowerAmount"]: paymentAmountCents,
    };
  
    if (isYearly) {
      navigate("/yearly-payment-plan", { state: stateData });
    } else {
      navigate("/plans", { state: stateData });
    }
  };
  
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
  
  const isLoading =
    isUserLoading || paymentLoading || checkoutLoading || checkoutStatus === "pending";
  const isErrorState = isUserError || isPaymentError || isCheckoutError || !userData?.data;
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="loader"></div>
      </div>
    );
  }
  if (isErrorState) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-red-500">
          {userError?.message ||
            paymentError?.message ||
            checkoutError?.message ||
            "Failed to load data."}
        </p>
      </div>
    );
  }
  
  const cardPaymentMethods =
    paymentData?.data.data.filter((method: PaymentMethod) => method.type === "card") || [];
  
  const inputLabel = isYearly ? "Yearly Power Amount" : "Instant Power Amount";
  
  return (
    <div className="min-h-screen bg-white p-4">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <header className="mb-6 flex items-center">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-gray-700 hover:text-gray-900"
          >
            <IoIosArrowBack className="mr-2" size={24} />
            Back
          </button>
        </header>
        <h1 className="text-2xl font-bold mb-4">
          Flex all of ${checkoutTotalAmount.toFixed(2)}
        </h1>
        <FloatingLabelInputWithInstant
          label={inputLabel}
          value={paymentAmount}
          onChangeText={setPaymentAmount}
          keyboardType="text"
          instantPower={availablePower}
          powerType={isYearly ? "yearly" : "instantaneous"}
        />
        <div className="mt-4"></div>
        {additionalFields.map((field, index) => (
          <div key={index} className="mb-4">
            <FloatingLabelInputOverdraft
              label="Supercharge Amount"
              value={field}
              onChangeText={(value) => updateField(index, value)}
              keyboardType="text"
              selectedMethod={selectedPaymentMethod}
              onPaymentMethodPress={openModal}
            />
          </div>
        ))}
        <div className="flex space-x-4 mb-4">
          <button
            onClick={addField}
            className="flex-1 bg-white border border-gray-300 text-black text-base font-bold py-2 px-4 rounded-lg hover:bg-gray-50 transition"
          >
            Supercharge
          </button>
          <button
            onClick={navigateToPlansPage}
            className={`flex-1 bg-black text-white py-4 px-4 rounded-lg text-base font-bold hover:bg-gray-800 transition ${
              totalAmount === checkoutTotalAmount ? "" : "opacity-50 cursor-not-allowed"
            }`}
            disabled={totalAmount !== checkoutTotalAmount}
          >
            {paymentAmount
              ? `Flex $${parseFloat(paymentAmount).toFixed(2)}`
              : "Flex"}
          </button>
        </div>
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
                  <h2 className="text-xl font-semibold mb-4 px-4">Select Payment Method</h2>
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



export default MerchantShoppingContent;
