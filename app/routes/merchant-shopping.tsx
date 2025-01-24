// src/routes/merchant-shopping.tsx

import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "@remix-run/react";
import { PaymentMethod, usePaymentMethods } from "~/hooks/usePaymentMethods";
import { useUserDetails } from "~/hooks/useUserDetails";
import { useMerchantDetail } from "~/hooks/useMerchantDetail";
import { useSession } from "~/context/SessionContext";
import FloatingLabelInputWithInstant from "~/compoments/FloatingLabelInputWithInstant";
import FloatingLabelInputOverdraft from "~/compoments/FloatingLabelInputOverdraft";
import PaymentMethodItem from "~/compoments/PaymentMethodItem";
import ProtectedRoute from "~/compoments/ProtectedRoute";

const GREEN_COLOR = "#4cd964";

const MerchantShoppingContent: React.FC = () => {
  const [searchParams] = useSearchParams();
  const merchantId = searchParams.get("merchantId") || "";

  const [instantPowerAmount, setInstantPowerAmount] = useState("");
  const [additionalFields, setAdditionalFields] = useState<string[]>([]);

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

  // Access the access token from Context
  const { accessToken, setAccessToken } = useSession();
  console.log("userData", userData);

  useEffect(() => {
    // Example: Retrieve the token from sessionStorage or any other secure storage
    const storedToken = sessionStorage.getItem("accessToken");
    if (storedToken && !accessToken) {
      setAccessToken(storedToken);
    } else if (!storedToken) {
      console.warn("No access token found. Please log in.");
      // Redirect to login if no token
      navigate("/login");
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
    // Close modal logic
    const element = document.getElementById("payment-method-modal");
    if (element) {
      element.classList.add("hidden");
    }
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
    console.log("Instantaneous Power Amount:", instantPowerAmount);

    const superchargeDetails = additionalFields.map((field, index) => {
      console.log(
        `Field ${index + 1}: Supercharge Amount: ${field}, Payment Method ID: ${selectedPaymentMethod?.id}`
      );
      return {
        amount: convertToCents(field), // Convert supercharge amount to cents
        paymentMethodId: selectedPaymentMethod?.id,
      };
    });

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
    }).toString();

    if (smartPay) {
      navigate(`/PlansPage?${params}`);
    } else {
      navigate(`/payment_plans?${params}`);
    }
  };

  // Loading state
  if (isMerchantLoading || isUserLoading || paymentLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="loader"></div>
      </div>
    );
  }

  // Log errors and data for debugging
  console.log("userError", userError);
  console.log("paymentError", paymentError);
  console.log("!userData?.data", !userData?.data);
  console.log("accessToken", accessToken);

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
        {/* Logo */}
        {/* You can add your logo component or image here */}

        {/* Header */}
        <h1 className="text-2xl font-bold mb-4 text-center">
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

        {/* Additional Supercharge Fields */}
        {additionalFields.map((field, index) => (
          <div key={index} className="mb-4">
            <FloatingLabelInputOverdraft
              label="Supercharge Amount"
              value={field}
              onChangeText={(value) => updateField(index, value)}
              keyboardType="number"
              selectedMethod={selectedPaymentMethod}
              onPaymentMethodPress={() => {
                // Open payment method modal
                const element = document.getElementById("payment-method-modal");
                if (element) {
                  element.classList.remove("hidden");
                }
              }}
            />
          </div>
        ))}

        {/* Supercharge Button */}
        <button
          onClick={addField}
          className="w-full bg-black text-white py-2 px-4 rounded-lg mb-4 hover:bg-gray-800 transition-colors"
        >
          Supercharge
        </button>

        {/* Continue Button */}
        <button
          onClick={navigateToPlansPage}
          className="w-full bg-black text-white py-3 rounded-lg text-lg font-bold hover:bg-gray-800 transition-colors"
        >
          {totalAmount > 0 ? `Flex $${totalAmount}` : "Flex your payments"}
        </button>

        {/* Payment Method Modal */}
        <div
          id="payment-method-modal"
          className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center hidden z-50"
        >
          <div className="bg-white w-11/12 max-w-md rounded-lg shadow-lg p-4 relative">
            {/* Close Button */}
            <button
              onClick={() => {
                const element = document.getElementById("payment-method-modal");
                if (element) {
                  element.classList.add("hidden");
                }
              }}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
            >
              &times;
            </button>

            {/* Payment Settings Button */}
            <button
              onClick={() => {
                alert("Navigate to Payment Settings");
                // Implement actual navigation if needed
              }}
              className="w-full bg-black text-white py-2 px-4 rounded-lg mb-4 hover:bg-gray-800 transition-colors"
            >
              Payment Settings
            </button>

            {/* Payment Methods List */}
            <div className="space-y-4 overflow-y-auto max-h-60">
              {cardPaymentMethods.map((method, index) => (
                <PaymentMethodItem
                  key={method.id}
                  method={method}
                  selectedMethod={selectedPaymentMethod}
                  onSelect={handleMethodSelect}
                  GREEN_COLOR={GREEN_COLOR}
                  isLastItem={index === cardPaymentMethods.length - 1}
                />
              ))}
            </div>
          </div>
        </div>
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
