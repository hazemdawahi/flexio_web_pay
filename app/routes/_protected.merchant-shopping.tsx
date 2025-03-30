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
import { Toaster, toast } from "sonner";
import { useAvailableDiscounts } from "~/hooks/useAvailableDiscounts";
import { useMerchantDetail } from "~/hooks/useMerchantDetail";
import { useCompleteCheckout, CompleteCheckoutPayload } from "~/hooks/useCompleteCheckout";

interface LocationState {
  type?: "instantaneous" | "yearly";
}

const MerchantShoppingContent: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const stateData = (location.state as LocationState) || {};
  const paymentType = stateData.type || "instantaneous";
  const checkoutToken = sessionStorage.getItem("checkoutToken") || "";

  const [paymentAmount, setPaymentAmount] = useState("0.00");
  const [additionalFields, setAdditionalFields] = useState<string[]>([]);
  // New state to track payment method for each additional field.
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<(PaymentMethod | null)[]>([]);
  // State to track which additional field is active when opening the bottom sheet.
  const [activeFieldIndex, setActiveFieldIndex] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Allow only one discount to be selected, stored as an array of discount IDs (as strings)
  const [selectedDiscounts, setSelectedDiscounts] = useState<string[]>([]);
  // New state for showing the loading spinner when completing checkout.
  const [isCompleting, setIsCompleting] = useState(false);

  const {
    data: paymentData,
    isLoading: paymentLoading,
    isError: isPaymentError,
    error: paymentError,
  } = usePaymentMethods();
  // Global selected payment method for the instant amount (kept for zero amount case)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  console.log("selectedDiscounts", selectedDiscounts);

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

  // Convert the raw checkout total (in cents) to dollars
  const checkoutTotalAmount = checkoutData
    ? parseFloat(checkoutData.checkout.totalAmount.amount) / 100
    : 0;

  const merchantId = checkoutData?.checkout.merchant.id;
  console.log("merchant id ", merchantId);

  // Fetch merchant details using the provided hook.
  const { data: merchantDetailData } = useMerchantDetail(merchantId || "");
  // Base URL constant
  const baseUrl = "http://192.168.1.32:8080";
  console.log("merchantDetailData", merchantDetailData);

  // Order amount in dollars is now used directly
  const orderAmount = checkoutTotalAmount;

  const {
    data: discounts,
    isLoading: discountsLoading,
    error: discountsError,
  } = useAvailableDiscounts(merchantId || "", orderAmount);

  // Create a local variable to guarantee a defined array.
  const availableDiscounts = discounts ?? [];

  // Helper: get discount value (in dollars) from a discount object.
  const getDiscountValue = (discount: any): number => {
    if (discount.type === "PERCENTAGE_OFF" && discount.discountPercentage != null) {
      return checkoutTotalAmount * (discount.discountPercentage / 100);
    } else if (discount.discountAmount != null) {
      // Convert discount amount from cents to dollars
      return discount.discountAmount / 100;
    }
    return 0;
  };

  // Pre-select the best discount (if available) – the valid discount with the highest value.
  useEffect(() => {
    if (availableDiscounts.length > 0) {
      // Only consider discounts that do not push the total below 0.
      const validDiscounts = availableDiscounts.filter(
        (d: any) => checkoutTotalAmount - getDiscountValue(d) >= 0
      );
      if (validDiscounts.length > 0) {
        const bestDiscount = validDiscounts.reduce((prev: any, curr: any) =>
          getDiscountValue(curr) > getDiscountValue(prev) ? curr : prev
        );
        // Convert discount id to string
        setSelectedDiscounts([String(bestDiscount.id)]);
      } else {
        setSelectedDiscounts([]);
      }
    }
  }, [availableDiscounts, checkoutTotalAmount]);

  // Compute effective checkout total after discount (cannot be negative)
  const selectedDiscount = availableDiscounts.find((d: any) => String(d.id) === selectedDiscounts[0]);
  const effectiveCheckoutTotal = selectedDiscount
    ? Math.max(0, checkoutTotalAmount - getDiscountValue(selectedDiscount))
    : checkoutTotalAmount;

  // When adding a new field, initialize its value and assign the default payment method (if available)
  const addField = () => {
    setAdditionalFields((prev) => [...prev, "0.00"]);
    const cardPaymentMethods = paymentData?.data.data.filter(
      (method: PaymentMethod) => method.type === "card"
    );
    const defaultMethod = cardPaymentMethods && cardPaymentMethods.length > 0 ? cardPaymentMethods[0] : null;
    setSelectedPaymentMethods((prev) => [...prev, defaultMethod]);
  };
  const updateField = (index: number, value: string) => {
    setAdditionalFields((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  // Set default global payment method for instant payments.
  useEffect(() => {
    const cardPaymentMethods = paymentData?.data.data.filter(
      (method: PaymentMethod) => method.type === "card"
    );
    if (cardPaymentMethods && cardPaymentMethods.length > 0 && !selectedPaymentMethod) {
      setSelectedPaymentMethod(cardPaymentMethods[0]);
    }
  }, [paymentData, selectedPaymentMethod]);

  const isYearly = paymentType === "yearly";
  const availablePower = userData?.data?.user?.instantaneousPower;

  useEffect(() => {
    if (isYearly && paymentAmount === "") {
      setPaymentAmount("0.00");
    }
  }, [isYearly, paymentAmount]);

  // When a payment method is selected from the bottom sheet, update the method for the active field.
  const handleMethodSelect = useCallback(
    (method: PaymentMethod) => {
      if (activeFieldIndex !== null) {
        setSelectedPaymentMethods((prev) => {
          const newMethods = [...prev];
          newMethods[activeFieldIndex] = method;
          return newMethods;
        });
      }
      closeModal();
    },
    [activeFieldIndex]
  );

  // Since only one discount is allowed, simply set the selected discount in an array.
  const handleDiscountChange = (discountId: string | number) => {
    setSelectedDiscounts([String(discountId)]);
  };

  const calculateTotalAmount = () => {
    const superchargeTotal = additionalFields.reduce(
      (acc: number, field: string) => acc + parseFloat(field || "0"),
      0
    );
    const payment = parseFloat(paymentAmount || "0");
    return payment + superchargeTotal;
  };
  const totalAmount = calculateTotalAmount();

  // Original function to navigate to the payment plan page.
  const navigateToPlansPage = () => {
    const superchargeDetails = additionalFields.map((field: string, index: number) => ({
      amount: Math.round(parseFloat(field) * 100), // amount in cents
      paymentMethodId: selectedPaymentMethods[index]?.id || "",
    }));

    if (!userData?.data?.user?.settings) {
      alert("Error: User settings not available.");
      return;
    }

    const stateData = {
      amount: totalAmount, // amount in dollars
      superchargeDetails,
      paymentMethodId: selectedPaymentMethod?.id || "",
      paymentType,
      selectedDiscounts, // discount IDs stored as an array
      [isYearly ? "yearlyPowerAmount" : "instantPowerAmount"]: paymentAmount,
    };
    console.log("shopping data", stateData);
    if (isYearly) {
      navigate("/yearly-payment-plan", { state: stateData });
    } else {
      navigate("/plans", { state: stateData });
    }
  };

  // Set up the complete checkout hook.
  const { mutate: completeCheckout } = useCompleteCheckout();

  // Handler: if the instant amount is zero, complete checkout immediately.
  const handleFlex = () => {
    if (parseFloat(paymentAmount) === 0) {
      if (!selectedPaymentMethod) {
        alert("Please select a payment method.");
        return;
      }
      if (!checkoutToken) {
        alert("Checkout token is missing.");
        return;
      }
      // Build supercharge details from the additional fields.
      const superchargeDetails = additionalFields.map((field, index) => ({
        amount: Math.round(parseFloat(field) * 100), // convert dollars to cents
        paymentMethodId: selectedPaymentMethods[index]?.id || "",
      }));
      // Build the payload. Since the instant amount is zero, we set both instant and yearly amounts to 0.
      const payload: CompleteCheckoutPayload = {
        checkoutToken,
        instantAmount: 0,
        yearlyAmount: 0,
        selectedPaymentMethod: selectedPaymentMethod.id,
        superchargeDetails,
        paymentFrequency: "MONTHLY", // default value
        numberOfPayments: 1, // default value
        offsetStartDate: new Date().toISOString().split("T")[0], // default to today
        otherUsers: [], // no other user amounts
        discountIds: selectedDiscounts,
      };

      // Set loading state.
      console.log("payload", payload);
      setIsCompleting(true);
      completeCheckout(payload, {
        onSuccess: (data) => {
          setIsCompleting(false);
          console.log("Checkout successful:", data);
          const targetWindow = window.opener || window.parent || window;
          // If you have other user amounts, replace the empty array below with that variable.
          const otherUserAmounts: any[] = [];
          if (otherUserAmounts && otherUserAmounts.length > 0) {
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
      navigateToPlansPage();
    }
  };

  // Modified openModal to accept the index of the field.
  const openModal = (index: number) => {
    setActiveFieldIndex(index);
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

  const isLoading =
    isUserLoading || paymentLoading || checkoutLoading || checkoutStatus === "pending";
  const isErrorState =
    isUserError || isPaymentError || isCheckoutError || !userData?.data;

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
        {/* Header shows effective total after discount */}
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
          Flex all of ${effectiveCheckoutTotal.toFixed(2)}
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
              selectedMethod={selectedPaymentMethods[index]}
              // Pass the index so that only the targeted field is updated
              onPaymentMethodPress={() => openModal(index)}
            />
          </div>
        ))}
        {/* Display available discounts only if there is a loading, error, or available discount */}
        {(discountsLoading || discountsError || (availableDiscounts.length > 0)) && (
          <div className="mb-4">
            <h2 className="text-lg font-semibold mb-2">Available Discounts</h2>
            {discountsLoading ? (
              <p>Loading discounts...</p>
            ) : discountsError ? (
              <p className="text-red-500">Error loading discounts</p>
            ) : (
              <ul>
                {availableDiscounts.map((discount: any) => {
                  const isOptionDisabled = checkoutTotalAmount - getDiscountValue(discount) < 0;
                  return (
                    <li
                      key={discount.id}
                      onClick={() => {
                        if (!isOptionDisabled) handleDiscountChange(discount.id);
                      }}
                      className={`flex items-center justify-between border p-2 mb-2 rounded cursor-pointer ${
                        isOptionDisabled ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      <div className="flex items-center">
                        {merchantDetailData?.data?.brand?.displayLogo && (
                          <img
                            src={
                              merchantDetailData.data.brand.displayLogo.startsWith("http")
                                ? merchantDetailData.data.brand.displayLogo
                                : `${baseUrl}${merchantDetailData.data.brand.displayLogo}`
                            }
                            alt={merchantDetailData.data.brand.displayName || "Brand Logo"}
                            className="w-10 h-10 rounded-full object-cover mr-4 border border-[#ccc]"
                          />
                        )}
                        <div>
                          <p className="font-bold">{discount.discountName}</p>
                          <p>
                            {discount.type === "PERCENTAGE_OFF"
                              ? `${discount.discountPercentage}% off`
                              : discount.discountAmount != null
                              ? `$${(discount.discountAmount / 100).toFixed(2)} off`
                              : ""}
                          </p>
                          {discount.expiresAt && (
                            <p>
                              Expires: {new Date(discount.expiresAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <input
                        type="radio"
                        name="discount"
                        disabled={isOptionDisabled}
                        checked={selectedDiscounts.includes(String(discount.id))}
                        onChange={(e) => {
                          e.stopPropagation();
                          if (!isOptionDisabled) handleDiscountChange(discount.id);
                        }}
                        className="ml-4 w-4 h-4 accent-blue-600"
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
        <div className="flex space-x-4 mb-4">
          <button
            onClick={addField}
            className="flex-1 bg-white border border-gray-300 text-black text-base font-bold py-2 px-4 rounded-lg hover:bg-gray-50 transition"
          >
            Supercharge
          </button>
          <button
            onClick={handleFlex}
            className={`flex-1 bg-black text-white py-4 px-4 rounded-lg text-base font-bold hover:bg-gray-800 transition ${
              totalAmount === effectiveCheckoutTotal ? "" : "opacity-50 cursor-not-allowed"
            }`}
            disabled={totalAmount !== effectiveCheckoutTotal || isCompleting}
          >
            {isCompleting ? (
              <div className="flex justify-center items-center">
                <div className="loader ease-linear rounded-full border-4 border-t-4 border-white h-6 w-6 mr-2"></div>
                <span>Processing...</span>
              </div>
            ) : paymentAmount && parseFloat(paymentAmount) > 0 ? (
              `Flex $${parseFloat(paymentAmount).toFixed(2)}`
            ) : (
              "Flex your payments"
            )}
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
                  <h2 className="text-xl font-semibold mb-4 px-4">
                    Select Payment Method
                  </h2>
                  <div className="space-y-4 px-4 pb-4">
                    {cardPaymentMethods.map((method, index) => (
                      <PaymentMethodItem
                        key={method.id}
                        method={method}
                        // Pass the selected method for the active field only.
                        selectedMethod={
                          activeFieldIndex !== null
                            ? selectedPaymentMethods[activeFieldIndex]
                            : null
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

export default MerchantShoppingContent;
