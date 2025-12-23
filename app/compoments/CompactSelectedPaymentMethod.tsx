// CompactSelectedPaymentMethod.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { PaymentMethod, usePaymentMethods } from "~/hooks/usePaymentMethods";
import { useUserDetails } from "~/hooks/useUserDetails";
import { getCardImage } from "~/lib/utils";

interface CompactSelectedPaymentMethodProps {
  selectedMethod: PaymentMethod | null;
  onPress: () => void;
  error?: string;
}

const CompactSelectedPaymentMethod: React.FC<CompactSelectedPaymentMethodProps> = ({
  selectedMethod,
  onPress,
  error,
}) => {
  const navigate = useNavigate();

  const { data: userRes } = useUserDetails();
  const userId: string | undefined = userRes?.data?.user?.id;
  const { data: methods = [] } = usePaymentMethods(userId);

  const firstCard: PaymentMethod | undefined = useMemo(
    () => methods.find((m) => m.type === 'card'),
    [methods]
  );

  const [displayMethod, setDisplayMethod] = useState<PaymentMethod | null>(selectedMethod);

  useEffect(() => {
    if (selectedMethod) setDisplayMethod(selectedMethod);
    else if (firstCard) setDisplayMethod(firstCard);
    else setDisplayMethod(null);
  }, [selectedMethod, firstCard]);

  const handlePress = () => {
    if (displayMethod) onPress();
    else navigate('/payment_methods');
  };

  return (
    <button
      onClick={handlePress}
      className={`flex-[0.6] h-full bg-white rounded-r-lg flex items-center justify-start px-2.5 ${
        error ? "border border-l-0 border-red-500" : "border border-l-0 border-gray-300"
      } focus:outline-hidden`}
      style={{
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
      }}
      aria-label="Select Payment Method"
    >
      {displayMethod ? (
        <div className="flex items-center w-full">
          {displayMethod.type === 'card' ? (
            <>
              <img
                src={getCardImage(displayMethod.card?.brand || "")}
                alt="Card"
                className="w-[30px] h-[30px] object-contain mr-2.5"
              />
              <span className="text-sm font-semibold flex-1 text-left truncate">
                {displayMethod.card?.brand ?? 'Card'} ****{displayMethod.card?.last4 ?? ''}
              </span>
            </>
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-[30px] h-[30px] mr-2.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"
                />
              </svg>
              <span className="text-sm font-semibold flex-1 text-left truncate">
                {displayMethod.bank?.institutionName ?? 'Bank'} ****{displayMethod.bank?.accounts?.[0]?.mask ?? ''}
              </span>
            </>
          )}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5 ml-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      ) : (
        <div className="flex items-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-[30px] h-[30px]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-semibold text-black ml-2">Credit / Debit Card</span>
        </div>
      )}
    </button>
  );
};

export default CompactSelectedPaymentMethod;