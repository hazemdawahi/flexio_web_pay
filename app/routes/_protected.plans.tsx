// app/routes/Plans.tsx

import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "@remix-run/react";
import { IoIosArrowBack } from "react-icons/io";
import ProtectedRoute from "~/compoments/ProtectedRoute";
import Tabs from "~/compoments/tabs";
import PaymentPlan from "~/routes/_protected.PaymentPlan";
import SmartPaymentPlans from "~/routes/_protected.SmartPaymentPlans";
import YearlyPaymentPlan from "./_protected.yearly-payment-plan";
import SelfPayPaymentPlan from "./_protected.SelfPayPaymentPlan";

// A split entry for other users
export interface SplitEntry {
  userId: string;
  amount: string; // dollars, e.g. "25.50"
}

// Supercharge per‑payment detail
export interface SuperchargeDetail {
  amount: string;        // dollars, e.g. "10.00"
  paymentMethodId: string;
}

// Payload coming in to this page
export interface PlansData {
  paymentType: "instantaneous" | "yearly" | "selfpay";
  instantPowerAmount: string;   // dollars, e.g. "100.00"
  superchargeDetails: SuperchargeDetail[];
  otherUserAmounts: SplitEntry[];
  selectedDiscounts: string[];  // discount IDs
  paymentMethodId?: string;
  // only used for self‑pay:
  users?: { id: string; username: string; logo: string; isCurrentUser?: boolean }[];
  splitData?: { userAmounts: SplitEntry[] };
}

const Plans: React.FC = () => {
  const [data, setData] = useState<PlansData | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // 1) Try React Router state
    if (location.state && Object.keys(location.state).length > 0) {
      setData(location.state as PlansData);
      return;
    }

    // 2) Otherwise parse from URL
    const params = new URLSearchParams(location.search);
    const instantPowerAmount = params.get("instantPowerAmount") || "";
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
      instantPowerAmount,
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

  // determine label & content for the first tab
  let firstLabel: string;
  let firstContent: React.ReactNode;
  switch (data.paymentType) {
    case "instantaneous":
      firstLabel = "Payment Plan";
      firstContent = (
        <PaymentPlan
          instantPowerAmount={data.instantPowerAmount}
          superchargeDetails={data.superchargeDetails}
          otherUserAmounts={data.otherUserAmounts}
          selectedDiscounts={data.selectedDiscounts}
          paymentMethodId={data.paymentMethodId}
        />
      );
      break;

    case "yearly":
      firstLabel = "Yearly Plan";
      firstContent = (
        <YearlyPaymentPlan
          yearlyPowerAmount={data.instantPowerAmount}
          superchargeDetails={data.superchargeDetails}
          otherUserAmounts={data.otherUserAmounts}
          paymentMethodId={data.paymentMethodId}
          selectedDiscounts={data.selectedDiscounts}
          modeSplit={false}
        />
      );
      break;

    case "selfpay":
      firstLabel = "Self Pay";
      firstContent = (
        <SelfPayPaymentPlan
          instantPowerAmount={data.instantPowerAmount}
          superchargeDetails={data.superchargeDetails}
          paymentMethodId={data.paymentMethodId!}
          otherUserAmounts={data.otherUserAmounts}
          selectedDiscounts={data.selectedDiscounts}
          users={data.users || []}
          splitData={data.splitData}
        />
      );
      break;

    default:
      firstLabel = "Payment";
      firstContent = <p className="p-4 text-red-600">Invalid payment type: {data.paymentType}</p>;
  }

  const tabs = [
    { label: firstLabel, content: <div className="px-4">{firstContent}</div> },
    {
      label: "Smart Payment Plan",
      content: (
        <div className="px-4">
          <SmartPaymentPlans
            instantPowerAmount={data.instantPowerAmount}
            superchargeDetails={data.superchargeDetails}
            otherUserAmounts={data.otherUserAmounts}
            selectedDiscounts={data.selectedDiscounts}
          />
        </div>
      ),
    },
  ];

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

        <div className="mt-4">
          <Tabs tabs={tabs} />
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default Plans;
