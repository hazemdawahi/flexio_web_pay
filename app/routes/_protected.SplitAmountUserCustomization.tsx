import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "@remix-run/react";
import { Toaster, toast } from "sonner";
import { IoIosArrowBack } from "react-icons/io";
import { motion, AnimatePresence } from "framer-motion";
import FloatingLabelInputOverdraft from "~/compoments/FloatingLabelInputOverdraft";
import FloatingLabelInputWithInstant from "~/compoments/FloatingLabelInputWithInstant";
import PaymentMethodItem from "~/compoments/PaymentMethodItem";
import ProtectedRoute from "~/compoments/ProtectedRoute";
import { usePaymentMethods, PaymentMethod } from "~/hooks/usePaymentMethods";
import { useUserDetails } from "~/hooks/useUserDetails";
import { useSession } from "~/context/SessionContext";
import { useCheckoutDetail } from "~/hooks/useCheckoutDetail";
import { useCompleteCheckout, CompleteCheckoutPayload } from "~/hooks/useCompleteCheckout";

// Reuse the same User and SplitData types
export interface User {
  id: string;
  username: string;
  logo: string;
  isCurrentUser?: boolean;
}

export interface SplitEntry {
  userId: string;
  amount: string;
}

export interface SplitData {
  type: string; // e.g., "split"
  userAmounts: SplitEntry[];
}

// Extend LocationState to include selectedDiscounts
interface LocationState {
  splitData: SplitData;
  users: User[];
  type?: "instantaneous" | "yearly" | "split";
  selectedDiscounts?: string[];
}

interface SuperchargeDetail {
  amount: number; // amount in cents as number
  paymentMethodId: string;
}

const SplitAmountUserCustomization: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Extract splitData, users, type, and selectedDiscounts from location.state
  const state = location.state as LocationState;
  const { splitData, users, type, selectedDiscounts } =
    state || { splitData: null, users: [], type: "split", selectedDiscounts: [] };

  console.log("splitData", splitData);
  if (!splitData || !users || users.length === 0) {
    toast.error("No user split data provided.");
    navigate(-1);
    return null;
  }

  const userAmountsArray = splitData.userAmounts;
  console.log("userAmounts", userAmountsArray, "type:", type);

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

  // Global payment method for the main payment (unchanged)
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethod | null>(null);

  // Payment amount state (for split customization)
  const [paymentAmount, setPaymentAmount] = useState<string>("0.00");
  // Additional supercharge fields (optional)
  const [additionalFields, setAdditionalFields] = useState<string[]>([]);
  // New state to track payment method for each additional field
  const [selectedFieldPaymentMethods, setSelectedFieldPaymentMethods] = useState<(PaymentMethod | null)[]>([]);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  // Active field index for modal payment selection
  const [activeFieldIndex, setActiveFieldIndex] = useState<number | null>(null);
  // State for loading spinner when completing checkout
  const [isCompleting, setIsCompleting] = useState<boolean>(false);

  // Import complete checkout and assign mutate to completeCheckout.
  const { mutate: completeCheckout } = useCompleteCheckout();

  // Determine if this is a yearly payment based on type passed in location state
  const isYearly = type === "yearly";

  // Based on payment type, set available power from user details (not used to prefill amount)
  const availablePower = isYearly
    ? userData?.data?.user?.yearlyPower
    : userData?.data?.user?.instantaneousPower;

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

  // Set default global payment method if not selected
  useEffect(() => {
    if (cardPaymentMethods.length > 0 && !selectedPaymentMethod) {
      setSelectedPaymentMethod(cardPaymentMethods[0]);
    }
  }, [cardPaymentMethods, selectedPaymentMethod]);

  // When adding a new field, add a default payment method for that field
  const addField = () => {
    setAdditionalFields([...additionalFields, "0.00"]);
    const defaultMethod = cardPaymentMethods.length > 0 ? cardPaymentMethods[0] : null;
    setSelectedFieldPaymentMethods([...selectedFieldPaymentMethods, defaultMethod]);
  };

  // Handle payment method selection for the main payment (unchanged)
  const handleMethodSelect = useCallback((method: PaymentMethod) => {
    // If modal opened for a specific field, update that field's payment method
    if (activeFieldIndex !== null) {
      setSelectedFieldPaymentMethods((prev) => {
        const newMethods = [...prev];
        newMethods[activeFieldIndex] = method;
        return newMethods;
      });
    } else {
      // Otherwise update global payment method
      setSelectedPaymentMethod(method);
    }
    closeModal();
  }, [activeFieldIndex]);

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

  // Helper: convert dollars to cents as number
  const paymentAmountParsedToCents = (amount: string): number => {
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed < 0) return 0;
    return Math.round(parsed * 100);
  };

  // New handler: if the main payment amount is zero, complete checkout immediately;
  // otherwise, navigate to the split plans page.
  const handleFlex = () => {
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
    // Use the selectedDiscounts from location state or fallback to an empty array.
    const discountIds = selectedDiscounts || [];

    console.log("discounts", discountIds);

    if (paymentParsed === 0) {
      // Complete checkout immediately
      if (!selectedPaymentMethod) {
        toast.error("Please select a payment method.");
        return;
      }
      if (!checkoutToken) {
        toast.error("Checkout token is missing.");
        return;
      }
      const superchargeDetails: SuperchargeDetail[] = additionalFields.map((field, index) => ({
        amount: paymentAmountParsedToCents(field),
        paymentMethodId: selectedFieldPaymentMethods[index]?.id || "",
      }));
      // Build other user amounts from split data (all except the current user)
      const otherUserAmountsPayload = userAmountsArray.slice(1).map((entry) => ({
        userId: entry.userId,
        amount: Math.round(parseFloat(entry.amount) * 100),
      }));
      const payload: CompleteCheckoutPayload = {
        checkoutToken,
        instantAmount: 0,
        yearlyAmount: 0,
        selectedPaymentMethod: selectedPaymentMethod.id,
        superchargeDetails,
        paymentFrequency: "MONTHLY", // default value
        numberOfPayments: 1, // default value
        offsetStartDate: new Date().toISOString().split("T")[0],
        otherUsers: otherUserAmountsPayload,
        discountIds: discountIds,
      };
      console.log("payload", payload);
      setIsCompleting(true);
      completeCheckout(payload, {
        onSuccess: (data: any) => {
          setIsCompleting(false);
          console.log("Checkout successful:", data);
          const targetWindow = window.opener || window.parent || window;
          if (otherUserAmountsPayload && otherUserAmountsPayload.length > 0) {
            targetWindow.postMessage(
              {
                status: "PENDING",
                checkoutToken,
                data,
              },
              "*"
            );
            toast.success("Payment plan confirmed for other user amounts. Payment is pending!");
          } else {
            targetWindow.postMessage(
              {
                status: "COMPLETED",
                checkoutToken,
                data,
              },
              "*"
            );
            toast.success("Payment plan confirmed successfully!");
          }
        },
        onError: (error: Error) => {
          setIsCompleting(false);
          console.error("Error during checkout:", error);
          alert("Failed to complete checkout. Please try again.");
        },
      });
    } else {
      // Navigate to split plans page with parameters
      const superchargeDetailsPayload: SuperchargeDetail[] = additionalFields
        .map((field, index) => ({
          amount: paymentAmountParsedToCents(field),
          paymentMethodId: selectedFieldPaymentMethods[index]?.id || "",
        }))
        .filter((detail) => detail.amount !== 0 && detail.paymentMethodId);
      // For yearly, use the key 'yearlyPowerAmount'; otherwise, use 'instantPowerAmount'
      const amountKey = isYearly ? "yearlyPowerAmount" : "instantPowerAmount";
      const paramsObj: Record<string, string> = {
        [amountKey]: paymentAmount,
        superchargeDetails: JSON.stringify(superchargeDetailsPayload),
        otherUserAmounts: JSON.stringify(userAmountsArray),
        paymentMethodId: selectedPaymentMethod?.id || "",
        discountIds: JSON.stringify(discountIds),
      };
      const params = new URLSearchParams(paramsObj).toString();
      console.log("params", { params });
      if (isYearly) {
        navigate(`/yearly-payment-plan?${params}`);
      } else {
        navigate(`/plans?${params}`);
      }
    }
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
  const openModal = (index?: number) => {
    // If an index is provided, open modal for that field
    if (index !== undefined) {
      setActiveFieldIndex(index);
    } else {
      setActiveFieldIndex(null);
    }
    setIsModalOpen(true);
  };
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
              // Use the payment method specific to this field
              selectedMethod={selectedFieldPaymentMethods[index]}
              // Open modal passing the index so only that field is updated
              onPaymentMethodPress={() => openModal(index)}
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
            onClick={handleFlex}
            className={`flex-1 bg-black text-white py-4 px-4 rounded-lg text-base font-bold hover:bg-gray-800 transition ${
              totalAmount === userTotalAmount ? "" : "opacity-50 cursor-not-allowed"
            }`}
            disabled={totalAmount !== userTotalAmount || isCompleting}
          >
            {isCompleting ? (
              <div className="flex justify-center items-center">
                <div className="loader ease-linear rounded-full border-4 border-t-4 border-white h-6 w-6 mr-2"></div>
                <span>Processing...</span>
              </div>
            ) : paymentAmount
              ? `Flex your payments `
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
                        // If modal opened for a specific field, show that field's selected method; otherwise use global method
                        selectedMethod={
                          activeFieldIndex !== null
                            ? selectedFieldPaymentMethods[activeFieldIndex]
                            : selectedPaymentMethod
                        }
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

export default SplitAmountUserCustomization;
