// app/routes/Plans.tsx
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "@remix-run/react";
import { useSession } from "~/context/SessionContext";
import { IoIosArrowBack } from "react-icons/io";
import SmartPaymentPlans from "~/routes/_protected.SmartPaymentPlans";
import PaymentPlan from "~/routes/_protected.PaymentPlan";
import ProtectedRoute from "~/compoments/ProtectedRoute";
import Tabs from "~/compoments/tabs";

// Define the shape of a SplitEntry
export interface SplitEntry {
  userId: string;
  amount: string;
}

interface SuperchargeDetail {
  amount: string; // amount in cents
  paymentMethodId: string;
}

export interface PlansData {
  instantPowerAmount: string; // in cents
  superchargeDetails: SuperchargeDetail[];
  paymentMethodId: string;
  otherUserAmounts: SplitEntry[];
  selectedDiscounts: string[]; // new property for discount IDs
}

const Plans: React.FC = () => {
  const [data, setData] = useState<PlansData | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { accessToken } = useSession();

  useEffect(() => {
    // First, try to get data from location.state
    if (location.state && Object.keys(location.state).length > 0) {
      setData(location.state as PlansData);
    } else {
      // If no state was passed, fallback to reading query parameters
      const searchParams = new URLSearchParams(location.search);
      const instantPowerAmount = searchParams.get("instantPowerAmount") || "";
      const superchargeDetailsString = searchParams.get("superchargeDetails");
      const paymentMethodId = searchParams.get("paymentMethodId") || "";
      const otherUserAmountsString = searchParams.get("otherUserAmounts");
      const selectedDiscountsString = searchParams.get("selectedDiscounts");

      let superchargeDetails: SuperchargeDetail[] = [];
      if (superchargeDetailsString) {
        try {
          superchargeDetails = JSON.parse(superchargeDetailsString);
        } catch (error) {
          console.error("Error parsing superchargeDetails:", error);
        }
      }

      let otherUserAmounts: SplitEntry[] = [];
      if (otherUserAmountsString) {
        try {
          otherUserAmounts = JSON.parse(otherUserAmountsString);
        } catch (error) {
          console.error("Error parsing otherUserAmounts:", error);
        }
      }
      
      let selectedDiscounts: string[] = [];
      if (selectedDiscountsString) {
        try {
          selectedDiscounts = JSON.parse(selectedDiscountsString);
        } catch (error) {
          console.error("Error parsing selectedDiscounts:", error);
        }
      }

      const fetchedData: PlansData = {
        instantPowerAmount,
        superchargeDetails,
        paymentMethodId,
        otherUserAmounts,
        selectedDiscounts,
      };
      setData(fetchedData);
    }
  }, [location]);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p>Loading...</p>
      </div>
    );
  }

  const tabs = [
    {
      label: "Payment Plan",
      content: (
        <div className="px-4">
          <PaymentPlan
            instantPowerAmount={data.instantPowerAmount}
            superchargeDetails={data.superchargeDetails}
            paymentMethodId={data.paymentMethodId}
            otherUserAmounts={data.otherUserAmounts}
            selectedDiscounts={data.selectedDiscounts} // passed as prop
          />
        </div>
      ),
    },
    {
      label: "Smart Payment Plan",
      content: (
        <div className="px-4">
          <SmartPaymentPlans
            instantPowerAmount={data.instantPowerAmount}
            superchargeDetails={data.superchargeDetails}
            paymentMethodId={data.paymentMethodId}
            otherUserAmounts={data.otherUserAmounts}
            selectedDiscounts={data.selectedDiscounts} // passed as prop
          />
        </div>
      ),
    },
  ];

  return (
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
  );
};

export default Plans;
