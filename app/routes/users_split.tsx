// src/pages/MultipleUsersSendWeb.tsx

import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from '@remix-run/react';
import { Toaster, toast } from 'sonner';
import { IoIosArrowBack } from 'react-icons/io';
import { useFetchMultipleUserDetails } from '~/hooks/useFetchMultipleUserDetails';
import { useUserDetails } from '~/hooks/useUserDetails';
import { useCheckoutDetail } from '~/hooks/useCheckoutDetail';
import FloatingLabelInput from '~/compoments/FloatingLabelInput'; // Corrected path

interface LocationState {
  userIds: string[];
}

interface User {
  id: string;
  username: string;
  logo: string;
  isCurrentUser?: boolean;
}

const MultipleUsersSendWeb: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Extract userIds from location state
  const { userIds } = (location.state as LocationState) || { userIds: [] };
  const userIdsArray = Array.isArray(userIds) ? userIds : [];

  // Fetch multiple user details using React Query
  const {
    data: multipleUsersData,
    isLoading: isMultipleUsersLoading,
    error: multipleUsersError,
  } = useFetchMultipleUserDetails(userIdsArray);
  console.log("multipleUsersData", multipleUsersData);

  // Fetch current user details
  const {
    data: currentUserData,
    isLoading: isCurrentUserLoading,
    error: currentUserError,
  } = useUserDetails();
  console.log("currentUserData", currentUserData);

  // Fetch checkout details
  const checkoutToken = typeof window !== 'undefined' ? sessionStorage.getItem('checkoutToken') || '' : '';
  const {
    data: checkoutData,
    isLoading: isCheckoutLoading,
    error: checkoutError,
  } = useCheckoutDetail(checkoutToken);

  console.log("checkoutData", checkoutData);

  // State to hold all users (current user + selected users)
  const [users, setUsers] = useState<User[]>([]);

  // State to hold amounts entered for each user
  const [amounts, setAmounts] = useState<{ [key: string]: string }>({});

  // Calculate the total amount from checkout details
  const calculateCheckoutTotalAmount = (checkout: any): number => {
    if (!checkout) return 0;
    const shipping = checkout.shippingAmount?.amount || 0;
    const tax = checkout.taxAmount?.amount || 0;
    const itemsTotal = checkout.items.reduce(
      (sum: number, item: any) => sum + (item.price?.amount || 0) * (item.quantity || 0),
      0
    );
    const discountsTotal = checkout.discounts?.reduce(
      (sum: number, discount: any) => sum + (discount.amount?.amount || 0),
      0
    ) || 0;
    return shipping + tax + itemsTotal - discountsTotal;
  };

  const checkoutTotalAmount = checkoutData ? calculateCheckoutTotalAmount(checkoutData) : 0;

  // Map fetched data to User interface
  useEffect(() => {
    const mappedUsers: User[] = [];

    // Add current user as "You"
    if (currentUserData && currentUserData.success && currentUserData.data) {
      const currentUser = currentUserData.data.user;
      const user: User = {
        id: currentUser.id,
        username: 'You',
        logo: currentUser.logo || 'https://via.placeholder.com/150',
        isCurrentUser: true,
      };
      mappedUsers.push(user);
    }

    // Add other selected users
    if (multipleUsersData && multipleUsersData.success && multipleUsersData.data) {
      const otherUsers: User[] = multipleUsersData.data.map((item) => ({
        id: item.user.id,
        username: item.user.username,
        logo: item.user.logo || 'https://via.placeholder.com/150',
        isCurrentUser: false,
      }));
      mappedUsers.push(...otherUsers);
    }

    setUsers(mappedUsers);
  }, [currentUserData, multipleUsersData]);

  // Handler for the Split button
  const handleSplit = async () => {
    // Validate amounts
    for (const user of users) {
      const amountValue = amounts[user.id];
      if (!amountValue || parseFloat(amountValue) <= 0) {
        toast.error(`Please enter a valid amount for ${user.username}.`);
        return;
      }
    }

    // Calculate the sum of entered amounts
    const sumOfAmounts = Object.values(amounts).reduce((sum, val) => sum + parseFloat(val), 0);

    // Check if the sum matches the checkout total amount
    if (sumOfAmounts !== checkoutTotalAmount) {
      toast.error(`The total amount entered ($${sumOfAmounts.toFixed(2)}) does not match the required total ($${checkoutTotalAmount.toFixed(2)}).`);
      return;
    }

    const userAmounts = users.map((user) => ({
      userId: user.id,
      amount: amounts[user.id],
    }));

    try {
      const response = await sendRequest(userAmounts);
      if (response.success) {
        toast.success('Request sent successfully!');
        // Navigate to confirmation page
        navigate('/confirmation', { state: { userAmounts } });
      } else {
        throw new Error('Failed to send request.');
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred while sending the request.');
    }
  };

  // Mock function to simulate sending requests (replace with actual API call)
  const sendRequest = async (
    userAmounts: { userId: string; amount: string }[]
  ): Promise<{ success: boolean }> => {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Simulate success response
    return { success: true };
  };

  // Render loading state
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

  console.log("multipleUsersError || currentUserError || checkoutError || !checkoutData", multipleUsersError, currentUserError, checkoutError, !checkoutData);

  // Render error state
  if (multipleUsersError || currentUserError || checkoutError || !checkoutData) { // Updated condition
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

  return (
    <div className="min-h-screen bg-white p-6">
      {/* Header */}
      <header className="flex flex-col mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-700 hover:text-gray-900 font-semibold"
        >
          <IoIosArrowBack size={24} className="mr-2" />
          Back
        </button>
        <h1 className="text-3xl font-bold mt-2">Send Multiple to Users</h1>
      </header>

      {/* Display Checkout Total Amount */}
      <div className="mb-6">
        <p className="text-lg">
          <span className="font-semibold">Total Amount Required:</span> ${checkoutTotalAmount.toFixed(2)}
        </p>
      </div>

      {/* Users List */}
      <div className="space-y-6">
        {users.map((user) => (
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
                value={amounts[user.id] || ''}
                onChangeText={(text) => setAmounts({ ...amounts, [user.id]: text })}
                keyboardType="number-pad" // Changed to 'number-pad' for better mobile experience
                type="number"
                error={null} // You can pass specific errors here if needed
              />
            </div>
          </div>
        ))}

        {/* Split Button */}
        <div className="mt-8">
          <button
            onClick={handleSplit}
            className="w-full bg-black text-white font-bold py-4 rounded-md hover:bg-gray-800 transition text-lg"
          >
            Split
          </button>
        </div>
      </div>

      {/* React Sonner Toaster */}
      <Toaster richColors position="top-right" />
    </div>
  );
};

export default MultipleUsersSendWeb;
