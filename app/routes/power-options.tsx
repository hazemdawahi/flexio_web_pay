import React, { useEffect, useState } from "react";
import { HiOutlineLightningBolt, HiOutlineCalendar } from "react-icons/hi";
import { FaArrowLeft } from "react-icons/fa";
import { useLocation, useNavigate } from "@remix-run/react";
import ProtectedRoute from "~/compoments/ProtectedRoute";
import { useUserDetails } from "~/hooks/useUserDetails";

// Define types for split data
export interface SplitEntry {
  userId: string;
  amount: string;
}

// This interface now just holds userAmounts (if provided)
export interface SplitData {
  userAmounts: SplitEntry[];
}

const PowerOptionsContent: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [inApp, setInApp] = useState<boolean>(false);
  
  // Optional split data coming from the previous page
  const [splitData, setSplitData] = useState<SplitData | null>(null);

  // Check for split data in location.state
  useEffect(() => {
    const stateData = (location.state as { splitData?: SplitData }) || {};
    if (stateData.splitData) {
      setSplitData(stateData.splitData);
    }
  }, [location.state]);

  // Retrieve user details via the custom hook
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

  /**
   * Helper function to handle an option click.
   * If split data exists, state will be passed to the split customization page.
   * Otherwise, state data (with payment type) is passed to MerchantShopping.
   *
   * @param powerType The custom type to pass (e.g. "instantaneous" or "yearly")
   */
  const handleOptionClick = (powerType: "instantaneous" | "yearly") => {
    if (splitData && splitData.userAmounts && splitData.userAmounts.length > 0) {
      navigate("/SplitAmountUserCustomization", {
        state: { userAmounts: splitData.userAmounts, type: powerType },
      });
    } else {
      navigate("/merchant-shopping", { state: { type: powerType } });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white p-4">
      {/* Header with go-back arrow and title */}
      <header className="w-full max-w-3xl mb-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-700 hover:text-gray-900 mb-2"
          aria-label="Go back"
        >
          <FaArrowLeft className="mr-2" size={20} />
          Back
        </button>
        <h1 className="text-3xl font-bold text-left">
          Choose Your Power Plan
        </h1>
      </header>

      {userError && (
        <div className="mb-4 text-red-500">
          Error loading user details.
        </div>
      )}

      {/* Instantaneous Power Option */}
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
            ) : instantaneousPower !== undefined ? (
              <span className="text-lg font-normal text-gray-600">
                (${(instantaneousPower / 100).toFixed(2)})
              </span>
            ) : (
              "(N/A)"
            )}
          </h2>
          <p className="text-gray-600">
            Get immediate power when you need it. Enjoy fast access to energy.
          </p>
        </div>
      </div>

      {/* Yearly Power Option */}
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
            ) : yearlyPower !== undefined ? (
              <span className="text-lg font-normal text-gray-600">
                (${(yearlyPower / 100).toFixed(2)})
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
    </div>
  );
};

const PowerOptions: React.FC = () => {
  return (
    <ProtectedRoute>
      <PowerOptionsContent />
    </ProtectedRoute>
  );
};

export default PowerOptions;
