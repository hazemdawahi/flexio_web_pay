import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from '@remix-run/react';
import { Toaster, toast } from 'sonner';
import { IoIosArrowBack } from 'react-icons/io';

// Hooks (replace with your actual implementations)
import { useFetchMultipleUserDetails } from '~/hooks/useFetchMultipleUserDetails';
import { useUserDetails } from '~/hooks/useUserDetails';
import { useCheckoutDetail, CheckoutDetail } from '~/hooks/useCheckoutDetail';
import FloatingLabelInput from '~/compoments/Floatinglabelinpunt';

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

  // State: array of user info
  const [users, setUsers] = useState<User[]>([]);

  // State: final amounts (read-only or final after save)
  const [amounts, setAmounts] = useState<{ [key: string]: string }>({});

  // State: temporary amounts (when adjusting)
  const [tempAmounts, setTempAmounts] = useState<{ [key: string]: string }>({});

  // Whether fields are in "adjust mode"
  const [isAdjusting, setIsAdjusting] = useState(false);

  // State to track if the split is even
  const [isEvenSplit, setIsEvenSplit] = useState(true);

  // Calculate the total amount from checkout details (API returns cents)
  const calculateCheckoutTotalAmount = (checkout: CheckoutDetail): number => {
    if (!checkout) return 0;
    return parseFloat(checkout.totalAmount.amount);
  };

  const checkoutTotalAmount = checkoutData
    ? calculateCheckoutTotalAmount(checkoutData.checkout)
    : 0;

  // ---------------------------
  //  Initialize data on mount
  // ---------------------------
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

    if (mappedUsers.length === 0) {
      toast.error("No users found for splitting.");
      navigate(-1);
      return;
    }
    setUsers(mappedUsers);

    // Compute initial even split
    if (mappedUsers.length > 0) {
      const total = checkoutTotalAmount;
      const numUsers = mappedUsers.length;
      const baseAmount = Math.floor((total / numUsers) * 100) / 100;
      const newAmounts: { [key: string]: string } = {};
      let accumulated = 0;

      for (let i = 0; i < numUsers; i++) {
        const user = mappedUsers[i];
        if (i === numUsers - 1) {
          const last = (total - accumulated).toFixed(2);
          newAmounts[user.id] = last;
        } else {
          const amt = baseAmount.toFixed(2);
          newAmounts[user.id] = amt;
          accumulated += baseAmount;
        }
      }

      setAmounts(newAmounts);
      setTempAmounts(newAmounts);
      setIsEvenSplit(true);
    }
  }, [currentUserData, multipleUsersData, checkoutTotalAmount, navigate]);

  // ------------------------------------------------
  //  Toggle between "Adjust" and "Save Changes" mode
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
    if (sumOfLocked > checkoutTotalAmount) {
      toast.error(
        `Your changes exceed the total amount of $${checkoutTotalAmount.toFixed(
          2
        )}. Please adjust.`
      );
      return;
    }

    let leftover = checkoutTotalAmount - sumOfLocked;
    const newAmounts: { [key: string]: string } = {};

    for (const user of users) {
      newAmounts[user.id] = tempAmounts[user.id];
    }

    if (unchangedUserIds.length > 0) {
      const perUser = Math.floor((leftover / unchangedUserIds.length) * 100) / 100;
      let distributedSoFar = 0;

      unchangedUserIds.forEach((userId, idx) => {
        if (idx === unchangedUserIds.length - 1) {
          const lastAmount = leftover - distributedSoFar;
          newAmounts[userId] = lastAmount.toFixed(2);
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
    if (Math.abs(finalSum - checkoutTotalAmount) > 0.01) {
      toast.error(
        `Adjusted total $${finalSum.toFixed(
          2
        )} does not match required $${checkoutTotalAmount.toFixed(
          2
        )}. Please adjust manually.`
      );
      return;
    }

    setAmounts(newAmounts);
    setIsAdjusting(false);
    setIsEvenSplit(false);
    toast.success('Amounts successfully updated!');
  };

  // ---------------------------
  //  Handle "Split Evenly" action
  // ---------------------------
  const handleSplitEvenly = () => {
    if (users.length === 0) return;

    const total = checkoutTotalAmount;
    const numUsers = users.length;
    const baseAmount = Math.floor((total / numUsers) * 100) / 100;
    const newAmounts: { [key: string]: string } = {};
    let accumulated = 0;

    for (let i = 0; i < numUsers; i++) {
      const user = users[i];
      if (i === numUsers - 1) {
        const last = (total - accumulated).toFixed(2);
        newAmounts[user.id] = last;
      } else {
        const amt = baseAmount.toFixed(2);
        newAmounts[user.id] = amt;
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
  //  Handle final "Split" call
  // ---------------------------
  const handleSplit = async () => {
    const sumOfAmounts = Object.values(amounts).reduce(
      (sum, val) => sum + parseFloat(val),
      0
    );

    if (Math.abs(sumOfAmounts - checkoutTotalAmount) > 0.01) {
      toast.error(
        `Total $${sumOfAmounts.toFixed(
          2
        )} does not match the required $${checkoutTotalAmount.toFixed(2)}.`
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
    // Navigate to the Power Options page, passing both split data and the full users array
    navigate('/power-options', { state: { splitData, users } });
  };

  // ------------------------------
  //  Loading & Error UI states
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
        <div className="mt-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              Split Total Amount: ${checkoutTotalAmount.toFixed(2)}
            </h1>
          </div>
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
      </div>

      <Toaster richColors position="top-right" />
    </div>
  );
};

export default MultipleUsersSendWeb;
