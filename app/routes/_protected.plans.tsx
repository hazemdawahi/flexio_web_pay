// app/routes/Plans.tsx

import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "@remix-run/react";
import { IoIosArrowBack } from "react-icons/io";
import PaymentPlan from "./_protected.PaymentPlan";
import SmartPaymentPlans from "./_protected.SmartPaymentPlans";
import SelfPayPaymentPlan from "./_protected.SelfPayPaymentPlan";
import ProtectedRoute from "~/compoments/ProtectedRoute";
import Tabs from "~/compoments/tabs";
import YearlyPaymentPlan from "./_protected.yearly-payment-plan";

// A split entry for other users
export interface SplitEntry {
  userId: string;
  amount: string; // dollars, e.g. "25.50"
}

// Supercharge per-payment detail
export interface SuperchargeDetail {
  amount: string;        // dollars, e.g. "10.00"
  paymentMethodId: string;
}

// Payload coming in to this page
export interface PlansData {
  paymentType: "instantaneous" | "yearly" | "selfpay";
  amount: string;               // dollars, e.g. "100.00"
  superchargeDetails: SuperchargeDetail[];
  otherUserAmounts: SplitEntry[];
  selectedDiscounts: string[];  // discount IDs
  paymentMethodId?: string;
}

const Plans: React.FC = () => {
  const [data, setData] = useState<PlansData | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.state && Object.keys(location.state).length > 0) {
      setData(location.state as PlansData);
      return;
    }

    const params = new URLSearchParams(location.search);
    // now reading "amount" instead of "instantPowerAmount"
    const amount = params.get("amount") || "";
    const superchargeDetailsParam = params.get("superchargeDetails");
    const otherUserAmountsParam = params.get("otherUserAmounts");
    const discountIdsParam = params.get("discountIds");
    const paymentType = (params.get("paymentType") as any) || "instantaneous";
    const paymentMethodId = params.get("paymentMethodId") || undefined;

    let superchargeDetails: SuperchargeDetail[] = [];
    if (superchargeDetailsParam) {
      try {
        superchargeDetails = JSON.parse(superchargeDetailsParam);
      } catch {
        console.error("Invalid superchargeDetails");
      }
    }

    let otherUserAmounts: SplitEntry[] = [];
    if (otherUserAmountsParam) {
      try {
        otherUserAmounts = JSON.parse(otherUserAmountsParam);
      } catch {
        console.error("Invalid otherUserAmounts");
      }
    }

    let selectedDiscounts: string[] = [];
    if (discountIdsParam) {
      try {
        selectedDiscounts = JSON.parse(discountIdsParam);
      } catch {
        console.error("Invalid discountIds");
      }
    }

    setData({
      paymentType,
      amount,
      superchargeDetails,
      otherUserAmounts,
      selectedDiscounts,
      paymentMethodId,
    });
  }, [location]);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p>Loading…</p>
      </div>
    );
  }

  const { paymentType, amount, superchargeDetails, otherUserAmounts, selectedDiscounts, paymentMethodId } = data;

  const renderPrimaryContent = () => {
    switch (paymentType) {
      case "instantaneous":
        return (
          <PaymentPlan
            instantPowerAmount={amount}
            superchargeDetails={superchargeDetails}
            otherUserAmounts={otherUserAmounts}
            selectedDiscounts={selectedDiscounts}
            paymentMethodId={paymentMethodId}
          />
        );

      case "yearly":
        return (
          <YearlyPaymentPlan
            yearlyPowerAmount={amount}
            superchargeDetails={superchargeDetails}
            otherUserAmounts={otherUserAmounts}
            paymentMethodId={paymentMethodId}
            selectedDiscounts={selectedDiscounts}
          />
        );

      case "selfpay":
        return (
          <SelfPayPaymentPlan
            instantPowerAmount={amount}
            superchargeDetails={superchargeDetails}
            paymentMethodId={paymentMethodId!}
            otherUserAmounts={otherUserAmounts}
            selectedDiscounts={selectedDiscounts}
          />
        );

      default:
        return (
          <p className="p-4 text-red-600">
            Invalid payment type: {paymentType}
          </p>
        );
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-white">
        <header className="flex items-center p-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-gray-700 hover:text-gray-900"
          >
            <IoIosArrowBack className="mr-2" size={24} />
            Back
          </button>
        </header>

        <div className="mt-4 px-4">
          {paymentType === "selfpay" ? (
            renderPrimaryContent()
          ) : (
            <Tabs
              tabs={[
                {
                  label: paymentType === "instantaneous" ? "Payment Plan" : "Yearly Plan",
                  content: <div className="px-4">{renderPrimaryContent()}</div>,
                },
                {
                  label: "Smart Payment Plan",
                  content: (
                    <div className="px-4">
                      <SmartPaymentPlans
                        instantPowerAmount={paymentType === "instantaneous" ? amount : undefined}
                        yearlyPowerAmount={paymentType === "yearly" ? amount : undefined}
                        superchargeDetails={superchargeDetails}
                        otherUserAmounts={otherUserAmounts}
                        selectedDiscounts={selectedDiscounts}
                        paymentMethodId={paymentMethodId}
                      />
                    </div>
                  ),
                },
              ]}
            />
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default Plans;
