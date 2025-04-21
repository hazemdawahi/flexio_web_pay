// app/routes/PowerOptionsContent.tsx

import React, { useEffect, useState } from "react";
import { HiOutlineLightningBolt, HiOutlineCalendar } from "react-icons/hi";
import { FaArrowLeft, FaCreditCard } from "react-icons/fa";
import { useLocation, useNavigate } from "@remix-run/react";
import ProtectedRoute from "~/compoments/ProtectedRoute";
import { useUserDetails } from "~/hooks/useUserDetails";
import { useCheckoutDetail } from "~/hooks/useCheckoutDetail";
import { toast, Toaster } from "sonner";

// Define types for split data
export interface SplitEntry {
  userId: string;
  amount: string;
}

// This interface now just holds userAmounts (if provided)
export interface SplitData {
  userAmounts: SplitEntry[];
}

export interface User {
  id: string;
  username: string;
  logo: string;
  isCurrentUser?: boolean;
}

// Define the shape of data to be passed to the Plans route
export interface PlansData {
  paymentType: "instantaneous" | "yearly" | "selfpay";
  instantPowerAmount: string; // in cents, as string
  superchargeDetails: { amount: string; paymentMethodId: string }[];
  paymentMethodId: string;
  otherUserAmounts: SplitEntry[];
  selectedDiscounts: string[];
  users?: User[];
  splitData?: SplitData;
}

const PowerOptionsContent: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [inApp, setInApp] = useState<boolean>(false);

  // Optional split data coming from the previous page
  const [splitData, setSplitData] = useState<SplitData | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  // State to hold the selected discounts list
  const [selectedDiscounts, setSelectedDiscounts] = useState<string[]>([]);

  // Retrieve split state from navigation if available
  useEffect(() => {
    const stateData = (location.state as {
      splitData?: SplitData;
      users?: User[];
      selectedDiscounts?: string[];
    }) || {};
    if (stateData.splitData) {
      setSplitData(stateData.splitData);
    }
    setUsers(stateData.users || []);
    if (stateData.selectedDiscounts) {
      setSelectedDiscounts(stateData.selectedDiscounts);
    }
  }, [location.state]);

  // Retrieve user details
  const {
    data: userDetailsData,
    isLoading: userLoading,
    isError: userError,
  } = useUserDetails();

  // Extract available power values (in cents)
  const instantaneousPower = userDetailsData?.data?.user?.instantaneousPower;
  const yearlyPower = userDetailsData?.data?.user?.yearlyPower;

  // Check sessionStorage for "inApp" value
  useEffect(() => {
    const value = sessionStorage.getItem("inApp");
    setInApp(value === "true");
  }, []);

  // Retrieve checkout details
  const checkoutToken =
    typeof window !== "undefined" ? sessionStorage.getItem("checkoutToken") || "" : "";
  const {
    data: checkoutData,
    isLoading: checkoutLoading,
    error: checkoutError,
  } = useCheckoutDetail(checkoutToken);

  // Determine if Self Pay is enabled and within tiers
  const isSelfPayEnabled = checkoutData?.configuration?.enableSelfPay;
  let isWithinSelfPayTier = false;
  if (
    !checkoutLoading &&
    checkoutData?.configuration?.selfPayTiers &&
    checkoutData.checkout?.totalAmount
  ) {
    const amt = parseFloat(checkoutData.checkout.totalAmount.amount);
    isWithinSelfPayTier = checkoutData.configuration.selfPayTiers.some((tier) => {
      const min = parseFloat(tier.minAmount);
      const max = parseFloat(tier.maxAmount);
      if (min === 0 && max === 0) return true;
      return amt >= min && amt <= max;
    });
  }

  /**
   * Handle option click for instantaneous/yearly.
   */
  const handleOptionClick = (powerType: "instantaneous" | "yearly") => {
    if (splitData && splitData.userAmounts.length > 0) {
      navigate("/SplitAmountUserCustomization", {
        state: { splitData, users, type: powerType, selectedDiscounts },
      });
    } else {
      navigate("/merchant-shopping", { state: { type: powerType } });
    }
  };

  /**
   * Handle Self Pay click: go to /plans with paymentType "selfpay"
   */
  const handleSelfPayClick = () => {
    const plansData: PlansData = {
      paymentType: "selfpay",
      instantPowerAmount:
        instantaneousPower != null ? instantaneousPower.toString() : "",
      superchargeDetails: [],
      paymentMethodId: "",
      otherUserAmounts: splitData ? splitData.userAmounts : [],
      selectedDiscounts,
      users: users.length > 0 ? users : undefined,
      splitData: splitData || undefined,
    };
    navigate("/plans", { state: plansData });
  };

  // render loading/error
  if (userError) {
    toast.error("Error loading user details.");
  }
  if (checkoutError) {
    toast.error("Error loading checkout details.");
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen flex flex-col bg-white p-4">
        <header className="w-full max-w-3xl mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-gray-700 hover:text-gray-900 mb-2"
            aria-label="Go back"
          >
            <FaArrowLeft className="mr-2" size={20} />
            Back
          </button>
          <h1 className="text-3xl font-bold text-left">Choose Your Power Plan</h1>
        </header>

        {/* Instantaneous */}
        <div
          onClick={() => handleOptionClick("instantaneous")}
          className="w-full max-w-3xl bg-white shadow-md rounded-2xl p-8 mb-6 flex items-center cursor-pointer hover:shadow-lg transition"
        >
          <HiOutlineLightningBolt className="text-black text-4xl mr-6" />
          <div>
            <h2 className="text-2xl font-bold mb-2">
              Instantaneous Power{" "}
              {userLoading ? (
                "Loading..."
              ) : instantaneousPower != null ? (
                <span className="text-lg text-gray-600">${instantaneousPower}</span>
              ) : (
                "(N/A)"
              )}
            </h2>
            <p className="text-gray-600">
              Get immediate power when you need it. Enjoy fast access to energy.
            </p>
          </div>
        </div>

        {/* Yearly */}
        <div
          onClick={() => handleOptionClick("yearly")}
          className="w-full max-w-3xl bg-white shadow-md rounded-2xl p-8 mb-6 flex items-center cursor-pointer hover:shadow-lg transition"
        >
          <HiOutlineCalendar className="text-black text-4xl mr-6" />
          <div>
            <h2 className="text-2xl font-bold mb-2">
              Yearly Power{" "}
              {userLoading ? (
                "Loading..."
              ) : yearlyPower != null ? (
                <span className="text-lg text-gray-600">
                  ${(yearlyPower / 5).toFixed(2)} / year
                </span>
              ) : (
                "(N/A)"
              )}
            </h2>
            <p className="text-gray-600">
              Secure your energy needs for the entire year with a convenient plan.
            </p>
          </div>
        </div>

        {/* Self Pay */}
        {!checkoutLoading && isSelfPayEnabled && isWithinSelfPayTier && (
          <div
            onClick={handleSelfPayClick}
            className="w-full max-w-3xl bg-white shadow-md rounded-2xl p-8 mb-6 flex items-center cursor-pointer hover:shadow-lg transition"
          >
            <FaCreditCard className="text-black text-4xl mr-6" />
            <div>
              <h2 className="text-2xl font-bold mb-2">Self Pay</h2>
              <p className="text-gray-600">
                Pay using your own debit or credit cards or bank account.
              </p>
            </div>
          </div>
        )}

        <Toaster richColors position="top-right" />
      </div>
    </ProtectedRoute>
  );
};

export default PowerOptionsContent;
