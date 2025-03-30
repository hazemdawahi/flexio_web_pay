import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from '@remix-run/react';
import { Toaster, toast } from 'sonner';
import { IoIosArrowBack } from 'react-icons/io';

// Hooks (replace with your actual implementations)
import { useFetchMultipleUserDetails } from '~/hooks/useFetchMultipleUserDetails';
import { useUserDetails } from '~/hooks/useUserDetails';
import { useCheckoutDetail } from '~/hooks/useCheckoutDetail';
import FloatingLabelInput from '~/compoments/Floatinglabelinpunt';

// New hooks for discount functionality
import { useAvailableDiscounts } from '~/hooks/useAvailableDiscounts';
import { useMerchantDetail } from '~/hooks/useMerchantDetail';

interface LocationState {
  userIds: string[];
  // Optionally, a type can be passed (for example "yearly")
  type?: "instantaneous" | "yearly" | "split";
}

export interface User {
  id: string;
  username: string;
  logo: string;
  isCurrentUser?: boolean;
}

// Define the type for each split entry
export interface SplitEntry {
  userId: string;
  amount: string;
}

// Define the type for the split data object
export interface SplitData {
  type: 'split';
  userAmounts: SplitEntry[];
}

const MultipleUsersSendWeb: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Extract userIds (and optionally type) from location state
  const state = (location.state as LocationState) || { userIds: [] };
  const { userIds, type } = state;
  const userIdsArray = Array.isArray(userIds) ? userIds : [];

  // Define isYearly flag (defaults to false if type is not "yearly")
  const isYearly = type === "yearly";

  // Fetch multiple user details
  const {
    data: multipleUsersData,
    isLoading: isMultipleUsersLoading,
    error: multipleUsersError,
  } = useFetchMultipleUserDetails(userIdsArray);

  // Fetch current user details
  const {
    data: currentUserData,
    isLoading: isCurrentUserLoading,
    error: currentUserError,
  } = useUserDetails();

  // Fetch checkout details
  const checkoutToken =
    typeof window !== 'undefined'
      ? sessionStorage.getItem('checkoutToken') || ''
      : '';
  const {
    data: checkoutData,
    isLoading: isCheckoutLoading,
    error: checkoutError,
  } = useCheckoutDetail(checkoutToken);

  // ------------------------------
  // Conversion: convert cents to dollars
  // ------------------------------
  // Assume checkoutData.checkout.totalAmount.amount is in cents (e.g. 100000)
  // Convert it to dollars (e.g. 1000.00)
  const rawCheckoutAmount = checkoutData
    ? parseFloat(checkoutData.checkout.totalAmount.amount)
    : 0;
  const checkoutTotalAmount = rawCheckoutAmount / 100;
  const merchantId = checkoutData?.checkout.merchant.id;

  // ------------------------------
  // Discount functionality setup
  // ------------------------------
  // Fetch available discounts (using checkoutTotalAmount in dollars)
  const {
    data: discounts,
    isLoading: discountsLoading,
    error: discountsError,
  } = useAvailableDiscounts(merchantId || "", checkoutTotalAmount);

  // Fetch merchant details (for brand logo etc.)
  const { data: merchantDetailData } = useMerchantDetail(merchantId || "");
  const baseUrl = "http://192.168.1.32:8080";

  // State for selected discount (allow only one)
  const [selectedDiscounts, setSelectedDiscounts] = useState<string[]>([]);

  // Helper: Calculate discount value (in dollars)
  const getDiscountValue = (discount: any): number => {
    if (discount.type === "PERCENTAGE_OFF" && discount.discountPercentage != null) {
      return checkoutTotalAmount * (discount.discountPercentage / 100);
    } else if (discount.discountAmount != null) {
      // discount.discountAmount is in cents so convert to dollars
      return discount.discountAmount / 100;
    }
    return 0;
  };

  // Auto-select the best discount (if available)
  useEffect(() => {
    if (discounts && discounts.length > 0) {
      const validDiscounts = discounts.filter(
        (d: any) => checkoutTotalAmount - getDiscountValue(d) >= 0
      );
      if (validDiscounts.length > 0) {
        const bestDiscount = validDiscounts.reduce((prev: any, curr: any) =>
          getDiscountValue(curr) > getDiscountValue(prev) ? curr : prev
        );
        setSelectedDiscounts([bestDiscount.id]);
      } else {
        setSelectedDiscounts([]);
      }
    }
  }, [discounts, checkoutTotalAmount]);

  // Compute effective checkout total using selected discount (if any)
  const selectedDiscount = discounts?.find((d: any) => d.id === selectedDiscounts[0]);
  const effectiveCheckoutTotal =
    discounts && selectedDiscount
      ? Math.max(0, checkoutTotalAmount - getDiscountValue(selectedDiscount))
      : checkoutTotalAmount;

  // ------------------------------
  // Users and split state
  // ------------------------------
  // State: array of user info
  const [users, setUsers] = useState<User[]>([]);
  // State: final amounts (after split, in dollars formatted as a string)
  const [amounts, setAmounts] = useState<{ [key: string]: string }>({});
  // State: temporary amounts (when adjusting)
  const [tempAmounts, setTempAmounts] = useState<{ [key: string]: string }>({});
  // Whether fields are in "adjust mode"
  const [isAdjusting, setIsAdjusting] = useState(false);
  // State to track if the split is even
  const [isEvenSplit, setIsEvenSplit] = useState(true);

  // ------------------------------
  // Initialize user data and even split amounts
  // ------------------------------
  useEffect(() => {
    const mappedUsers: User[] = [];

    // Current user
    if (currentUserData?.success && currentUserData?.data) {
      const currentUser = currentUserData.data.user;
      mappedUsers.push({
        id: currentUser.id,
        username: 'You',
        logo: currentUser.logo || 'https://via.placeholder.com/150',
        isCurrentUser: true,
      });
    }

    // Other selected users
    if (multipleUsersData?.success && multipleUsersData?.data) {
      const otherUsers: User[] = multipleUsersData.data.map((item: any) => ({
        id: item.user.id,
        username: item.user.username,
        logo: item.user.logo || 'https://via.placeholder.com/150',
        isCurrentUser: false,
      }));
      mappedUsers.push(...otherUsers);
    }

    setUsers(mappedUsers);

    // Compute initial even split using effective total after discount
    if (mappedUsers.length > 0) {
      const total = effectiveCheckoutTotal;
      const numUsers = mappedUsers.length;
      const baseAmount = total / numUsers;
      const newAmounts: { [key: string]: string } = {};
      let accumulated = 0;

      for (let i = 0; i < numUsers; i++) {
        const user = mappedUsers[i];
        if (i === numUsers - 1) {
          newAmounts[user.id] = (total - accumulated).toFixed(2);
        } else {
          newAmounts[user.id] = baseAmount.toFixed(2);
          accumulated += baseAmount;
        }
      }

      setAmounts(newAmounts);
      setTempAmounts(newAmounts);
      setIsEvenSplit(true);
    }
  }, [currentUserData, multipleUsersData, effectiveCheckoutTotal]);

  // If even split is still active, update amounts when effective total changes
  useEffect(() => {
    if (isEvenSplit && users.length > 0) {
      const total = effectiveCheckoutTotal;
      const numUsers = users.length;
      const baseAmount = total / numUsers;
      const newAmounts: { [key: string]: string } = {};
      let accumulated = 0;
      for (let i = 0; i < numUsers; i++) {
        const user = users[i];
        if (i === numUsers - 1) {
          newAmounts[user.id] = (total - accumulated).toFixed(2);
        } else {
          newAmounts[user.id] = baseAmount.toFixed(2);
          accumulated += baseAmount;
        }
      }
      setAmounts(newAmounts);
      setTempAmounts(newAmounts);
    }
  }, [effectiveCheckoutTotal, isEvenSplit, users]);

  // ------------------------------------------------
  // Toggle between "Adjust" and "Save Changes" mode
  // ------------------------------------------------
  const handleAdjustToggle = () => {
    if (!isAdjusting) {
      setIsAdjusting(true);
      setTempAmounts(amounts);
      return;
    }

    // Save changes: determine locked (changed) fields
    const lockedEntries: { userId: string; value: number }[] = [];
    const unchangedUserIds: string[] = [];

    for (const user of users) {
      const oldVal = parseFloat(amounts[user.id] || '0');
      const newVal = parseFloat(tempAmounts[user.id] || '0');
      if (Math.abs(newVal - oldVal) > 0.000001) {
        lockedEntries.push({ userId: user.id, value: newVal });
      } else {
        unchangedUserIds.push(user.id);
      }
    }

    let sumOfLocked = lockedEntries.reduce((acc, entry) => acc + entry.value, 0);
    if (sumOfLocked > effectiveCheckoutTotal) {
      toast.error(
        `Your changes exceed the total amount of ${effectiveCheckoutTotal.toFixed(2)}. Please adjust.`
      );
      return;
    }

    let leftover = effectiveCheckoutTotal - sumOfLocked;
    const newAmounts: { [key: string]: string } = {};

    for (const user of users) {
      newAmounts[user.id] = tempAmounts[user.id];
    }

    if (unchangedUserIds.length > 0) {
      const perUser = leftover / unchangedUserIds.length;
      let distributedSoFar = 0;

      unchangedUserIds.forEach((userId, idx) => {
        if (idx === unchangedUserIds.length - 1) {
          newAmounts[userId] = (leftover - distributedSoFar).toFixed(2);
        } else {
          newAmounts[userId] = perUser.toFixed(2);
          distributedSoFar += perUser;
        }
      });
    } else {
      if (leftover > 0 && lockedEntries.length > 0) {
        const lastIndex = lockedEntries.length - 1;
        lockedEntries[lastIndex].value += leftover;
        newAmounts[lockedEntries[lastIndex].userId] = lockedEntries[lastIndex].value.toFixed(2);
        leftover = 0;
      }
    }

    const finalSum = Object.values(newAmounts).reduce(
      (acc, val) => acc + parseFloat(val),
      0
    );
    if (Math.abs(finalSum - effectiveCheckoutTotal) > 0.01) {
      toast.error(
        `Adjusted total ${finalSum.toFixed(2)} does not match required ${effectiveCheckoutTotal.toFixed(2)}. Please adjust manually.`
      );
      return;
    }

    setAmounts(newAmounts);
    setIsAdjusting(false);
    setIsEvenSplit(false);
    toast.success('Amounts successfully updated!');
  };

  // ---------------------------
  // Handle "Split Evenly" action
  // ---------------------------
  const handleSplitEvenly = () => {
    if (users.length === 0) return;

    const total = effectiveCheckoutTotal;
    const numUsers = users.length;
    const baseAmount = total / numUsers;
    const newAmounts: { [key: string]: string } = {};
    let accumulated = 0;

    for (let i = 0; i < numUsers; i++) {
      const user = users[i];
      if (i === numUsers - 1) {
        newAmounts[user.id] = (total - accumulated).toFixed(2);
      } else {
        newAmounts[user.id] = baseAmount.toFixed(2);
        accumulated += baseAmount;
      }
    }

    setAmounts(newAmounts);
    setTempAmounts(newAmounts);
    setIsEvenSplit(true);
    setIsAdjusting(false);
    toast.success('Amounts split evenly!');
  };

  // ---------------------------
  // Handle final "Split" call
  // ---------------------------
  const handleSplit = async () => {
    const sumOfAmounts = Object.values(amounts).reduce(
      (sum, val) => sum + parseFloat(val),
      0
    );

    if (Math.abs(sumOfAmounts - effectiveCheckoutTotal) > 0.01) {
      toast.error(
        `Total ${sumOfAmounts.toFixed(2)} does not match the required ${effectiveCheckoutTotal.toFixed(2)}.`
      );
      return;
    }

    // Build list of user IDs and their amounts
    const userAmounts = users.map((user) => ({
      userId: user.id,
      amount: amounts[user.id],
    }));

    // Create split data with type "split"
    const splitData: SplitData = {
      type: 'split',
      userAmounts,
    };

    console.log("Data to send:", splitData, users);
    // Navigate to the Power Options page, passing split data, full users array, and the selected discounts list
    navigate('/power-options', { state: { splitData, users, selectedDiscounts } });
  };

  // ------------------------------
  // Loading & Error UI states
  // ------------------------------
  if (isMultipleUsersLoading || isCurrentUserLoading || isCheckoutLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="text-center">
          <svg
            className="animate-spin h-10 w-10 text-gray-600 mx-auto mb-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            ></path>
          </svg>
          <p className="text-gray-600">Loading user details...</p>
        </div>
      </div>
    );
  }

  if (multipleUsersError || currentUserError || checkoutError || !checkoutData) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <p className="text-red-500">
          {multipleUsersError?.message ||
            currentUserError?.message ||
            checkoutError?.message ||
            'Failed to load user details.'}
        </p>
      </div>
    );
  }

  const inputLabel = isYearly ? "Yearly Power Amount" : "Instant Power Amount";

  return (
    <div className="min-h-screen bg-white p-6">
      {/* Header */}
      <header className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-700 hover:text-gray-900 font-semibold"
        >
          <IoIosArrowBack size={24} className="mr-2" />
          Back
        </button>
        <div className="mt-4 flex flex-row items-center justify-between">
          <h1 className="text-2xl font-bold">
            Split Total Amount: ${effectiveCheckoutTotal.toFixed(2)}
          </h1>
          <button
            onClick={handleSplitEvenly}
            className={`text-blue-500 font-semibold ${isEvenSplit ? 'underline' : ''} hover:text-blue-700`}
          >
            Split Evenly
          </button>
        </div>
      </header>

      {/* Users List */}
      <div className="space-y-6">
        {users.map((user) => {
          const displayValue = isAdjusting ? tempAmounts[user.id] : amounts[user.id];
          return (
            <div
              key={user.id}
              className="flex items-center p-4 bg-white border border-gray-300 rounded-lg shadow"
            >
              <img
                src={user.logo}
                alt={`${user.username} logo`}
                className="w-16 h-16 rounded-full mr-4 object-cover"
              />
              <div className="flex-1">
                <p className="text-xl pb-2 font-semibold">{user.username}</p>
                <FloatingLabelInput
                  label="Enter amount"
                  value={displayValue || ''}
                  onChangeText={(text) => {
                    if (isAdjusting) {
                      setTempAmounts((prev) => ({ ...prev, [user.id]: text }));
                      setIsEvenSplit(false);
                    }
                  }}
                  editable={isAdjusting}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Discounts Section (placed under the user list) */}
      {(discountsLoading || discountsError || (discounts && discounts.length > 0)) && (
        <div className="mt-6 mb-6">
          <h2 className="text-lg font-semibold mb-2">Available Discounts</h2>
          {discountsLoading ? (
            <p>Loading discounts...</p>
          ) : discountsError ? (
            <p className="text-red-500">Error loading discounts</p>
          ) : (
            <ul>
              {discounts!.map((discount: any) => {
                const isOptionDisabled = checkoutTotalAmount * 100 - getDiscountValue(discount) * 100 < 0;
                return (
                  <li
                    key={discount.id}
                    onClick={() => {
                      if (!isOptionDisabled) setSelectedDiscounts([discount.id]);
                    }}
                    className={`flex items-center justify-between border p-2 mb-2 rounded cursor-pointer ${
                      isOptionDisabled ? 'opacity-50 cursor-not-allowed' : ''
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
                          <p>Expires: {new Date(discount.expiresAt).toLocaleString()}</p>
                        )}
                      </div>
                    </div>
                    <input
                      type="radio"
                      name="discount"
                      disabled={isOptionDisabled}
                      checked={selectedDiscounts.includes(discount.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        if (!isOptionDisabled) setSelectedDiscounts([discount.id]);
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

      {/* Buttons Row */}
      <div className="mt-8 flex space-x-4">
        <button
          onClick={handleAdjustToggle}
          className="flex-1 bg-white border border-gray-300 text-black font-bold py-4 rounded-md hover:bg-gray-100 transition text-lg"
        >
          {isAdjusting ? 'Save Changes' : 'Adjust'}
        </button>
        <button
          onClick={handleSplit}
          className="flex-1 bg-black text-white font-bold py-4 rounded-md hover:bg-gray-800 transition text-lg"
        >
          Split
        </button>
      </div>

      <Toaster richColors position="top-right" />
    </div>
  );
};

export default MultipleUsersSendWeb;
