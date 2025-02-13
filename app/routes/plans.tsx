import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "@remix-run/react";
import { useSession } from "~/context/SessionContext";
import { IoIosArrowBack } from "react-icons/io";
import SmartPaymentPlans from "~/routes/SmartPaymentPlans";
import PaymentPlan from "~/routes/PaymentPlan";
import ProtectedRoute from "~/compoments/ProtectedRoute";
import Tabs from "~/compoments/tabs";

interface SuperchargeDetail {
  amount: string; // amount in cents
  paymentMethodId: string;
}

export interface PlansData {
  instantPowerAmount: string; // in cents
  superchargeDetails: SuperchargeDetail[];
  paymentMethodId: string;
}

const Plans: React.FC = () => {
  const [data, setData] = useState<PlansData | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { accessToken } = useSession();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const instantPowerAmount = searchParams.get("instantPowerAmount") || "";
    const superchargeDetailsString = searchParams.get("superchargeDetails");
    const paymentMethodId = searchParams.get("paymentMethodId") || "";

    let superchargeDetails: SuperchargeDetail[] = [];
    if (superchargeDetailsString) {
      try {
        superchargeDetails = JSON.parse(superchargeDetailsString);
      } catch (error) {
        console.error("Error parsing superchargeDetails:", error);
      }
    }

    const fetchedData: PlansData = {
      instantPowerAmount,
      superchargeDetails,
      paymentMethodId,
    };

    setData(fetchedData);
  }, [location.search, navigate]);

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
