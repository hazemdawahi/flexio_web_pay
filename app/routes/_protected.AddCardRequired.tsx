import React from "react";
import { useNavigate, useLocation } from "@remix-run/react";
import { FiCreditCard } from "react-icons/fi";
import { IoShieldCheckmarkOutline } from "react-icons/io5";
import { HiOutlineLockClosed } from "react-icons/hi2";

const AddCardRequired: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const source = (location.state as { source?: string })?.source || "";

  const goToPayments = () => {
    // 👉 Update this route to wherever your "Manage payment methods" lives.
    // Examples: `/PaymentMethods`, `/wallet`, `/settings/payments`
    navigate("/PaymentMethods", { state: { source } });
  };

  const retry = () => {
    // If the user has just added a card, let them try the app again.
    navigate("/UnifiedOptionsPage", { replace: true, state: { source } });
  };

  return (
    <div className="min-h-[80vh] max-w-lg mx-auto px-6 py-12 flex flex-col items-center justify-center text-center font-sans">
      {/* Icons row */}
      <div className="flex items-center justify-center gap-6 mb-6">
        <span className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gray-100">
          <FiCreditCard className="text-2xl" />
        </span>
        <span className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gray-100">
          <IoShieldCheckmarkOutline className="text-2xl" />
        </span>
        <span className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gray-100">
          <HiOutlineLockClosed className="text-2xl" />
        </span>
      </div>

      <h1 className="text-3xl font-bold mb-3">Add a card to get started</h1>
      <p className="text-gray-600 mb-8 leading-relaxed">
        To use Soteria, you’ll need to{" "}
        <span className="font-semibold">add or link a card payment method</span>.
        This helps us keep your account secure and unlocks all app features.
        You’re welcome to come back and try again anytime after adding a card.
      </p>

      <div className="w-full flex flex-col gap-3">
        <button
          onClick={goToPayments}
          className="w-full bg-black text-white font-semibold rounded-lg py-3.5 px-5"
        >
          Add / Link a Card
        </button>

        <button
          onClick={retry}
          className="w-full border border-gray-300 text-gray-800 font-semibold rounded-lg py-3.5 px-5"
        >
          I’ve added a card — Try Again
        </button>
      </div>

      <p className="text-xs text-gray-500 mt-6">
        Your payment information is encrypted and securely processed.
      </p>
    </div>
  );
};

export default AddCardRequired;
