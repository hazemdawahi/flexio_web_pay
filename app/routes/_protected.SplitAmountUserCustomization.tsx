// app/routes/SplitAmountUserCustomization.tsx

import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "@remix-run/react";
import { Toaster, toast } from "sonner";
import { IoIosArrowBack } from "react-icons/io";
import { motion, AnimatePresence } from "framer-motion";
import { usePaymentMethods, PaymentMethod } from "~/hooks/usePaymentMethods";
import { useUserDetails } from "~/hooks/useUserDetails";
import { useCheckoutDetail } from "~/hooks/useCheckoutDetail";
import FloatingLabelInputOverdraft from "~/compoments/FloatingLabelInputOverdraft";
import FloatingLabelInputWithInstant from "~/compoments/FloatingLabelInputWithInstant";
import PaymentMethodItem from "~/compoments/PaymentMethodItem";

export interface User {
  id: string;
  username: string;
  logo: string;
  isCurrentUser?: boolean;
}
export interface SplitEntry {
  userId: string;
  amount: string;
}
export interface SplitData {
  type: string;
  userAmounts: SplitEntry[];
}

interface LocationState {
  splitData: SplitData;
  users: User[];
  type?: "instantaneous" | "yearly" | "split";
  selectedDiscounts?: string[];
}

interface SuperchargeDetail {
  amount: string;       // dollars as string
  paymentMethodId: string;
}

const SplitAmountUserCustomization: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  // Cast location.state to our expected shape
  const { splitData, users, type = "split", selectedDiscounts = [] } =
    (location.state as LocationState) ?? {};

  if (!splitData || users.length === 0) {
    toast.error("No user split data provided.");
    navigate(-1);
    return null;
  }

  const userAmountsArray: SplitEntry[] = splitData.userAmounts;
  const currentUserSplit: SplitEntry =
    userAmountsArray.find((u: SplitEntry) =>
      u.userId === users.find((x: User) => x.isCurrentUser)?.id
    ) ?? userAmountsArray[0];

  const { data: userData, isLoading: isUserLoading } = useUserDetails();
  const checkoutToken =
    typeof window !== "undefined"
      ? sessionStorage.getItem("checkoutToken") || ""
      : "";
  useCheckoutDetail(checkoutToken); // just for loading
  const { data: paymentData, isLoading: paymentLoading } =
    usePaymentMethods();

  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethod | null>(null);
  const [paymentAmount, setPaymentAmount] =
    useState<string>(currentUserSplit.amount);
  const [additionalFields, setAdditionalFields] = useState<string[]>([]);
  const [selectedFieldPaymentMethods, setSelectedFieldPaymentMethods] =
    useState<(PaymentMethod | null)[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeFieldIndex, setActiveFieldIndex] = useState<number | null>(null);

  const isYearly = type === "yearly";
  const availablePower = isYearly
    ? userData?.data?.user?.yearlyPower
    : userData?.data?.user?.instantaneousPower;

  // initialize single card
  useEffect(() => {
    const cards =
      paymentData?.data.data.filter((m) => m.type === "card") || [];
    if (cards.length && !selectedPaymentMethod) {
      setSelectedPaymentMethod(cards[0]);
    }
  }, [paymentData]);

  const addField = () => {
    setAdditionalFields((prev) => [...prev, "0.00"]);
    const defaultCard = paymentData?.data.data.find(
      (m) => m.type === "card"
    ) ?? null;
    setSelectedFieldPaymentMethods((prev) => [...prev, defaultCard]);
  };

  const handleMethodSelect = useCallback(
    (method: PaymentMethod) => {
      if (activeFieldIndex !== null) {
        setSelectedFieldPaymentMethods((prev) => {
          const next = [...prev];
          next[activeFieldIndex] = method;
          return next;
        });
      } else {
        setSelectedPaymentMethod(method);
      }
      setIsModalOpen(false);
    },
    [activeFieldIndex]
  );

  const handlePaymentAmountChange = (value: string) => {
    if (/^\d+(\.\d{0,2})?$/.test(value) || value === "") {
      setPaymentAmount(value);
    }
  };
  const updateField = (idx: number, val: string) => {
    if (/^\d+(\.\d{0,2})?$/.test(val) || val === "") {
      setAdditionalFields((prev) => {
        const next = [...prev];
        next[idx] = val;
        return next;
      });
    }
  };

  const calculateTotalAmount = () => {
    const base = parseFloat(paymentAmount) || 0;
    const extra = additionalFields.reduce(
      (sum, f) => sum + parseFloat(f || "0"),
      0
    );
    return base + extra;
  };
  const totalAmount = calculateTotalAmount();

  const handleFlex = () => {
    if (
      Math.abs(totalAmount - parseFloat(currentUserSplit.amount)) > 0.01
    ) {
      toast.error(
        `Total must equal your split of $${parseFloat(
          currentUserSplit.amount
        ).toFixed(2)}.`
      );
      return;
    }
    if (parseFloat(paymentAmount) <= 0) {
      toast.error("Amount must be greater than 0.");
      return;
    }

    const superchargeDetails: SuperchargeDetail[] = additionalFields
      .map((amt, i) => ({
        amount: amt,
        paymentMethodId: selectedFieldPaymentMethods[i]?.id ?? "",
      }))
      .filter(
        (d) => parseFloat(d.amount) > 0 && d.paymentMethodId
      );

    // navigate to /plans with correct paymentType
    navigate("/plans", {
      state: {
        paymentType: type, // use incoming type
        instantPowerAmount: paymentAmount,
        superchargeDetails,
        otherUserAmounts: userAmountsArray,
        selectedDiscounts,
        paymentMethodId: selectedPaymentMethod?.id,
        users,
        splitData,
      },
    });
  };

  const openModal = (idx?: number) => {
    setActiveFieldIndex(idx ?? null);
    setIsModalOpen(true);
  };
  const closeModal = () => setIsModalOpen(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && isModalOpen && closeModal();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isModalOpen]);
  useEffect(() => {
    document.body.style.overflow = isModalOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isModalOpen]);

  const isLoading = isUserLoading || paymentLoading;
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="loader" />
      </div>
    );
  }

  const inputLabel = isYearly
    ? "Yearly Power Amount"
    : "Instant Power Amount";

  return (
    <div className="min-h-screen bg-white p-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center text-gray-700 hover:text-gray-900 mb-4"
      >
        <IoIosArrowBack size={20} className="mr-2" /> Back
      </button>

      <h1 className="text-2xl font-bold mb-4">
        Your split: ${parseFloat(currentUserSplit.amount).toFixed(2)}
      </h1>

      <FloatingLabelInputWithInstant
        label={inputLabel}
        value={paymentAmount}
        onChangeText={handlePaymentAmountChange}
        instantPower={availablePower}
        powerType={isYearly ? "yearly" : "instantaneous"}
      />

      {additionalFields.map((f, i) => (
        <div key={i} className="mt-4">
          <FloatingLabelInputOverdraft
            label={`Supercharge ${i + 1}`}
            value={f}
            onChangeText={(v) => updateField(i, v)}
            selectedMethod={selectedFieldPaymentMethods[i]}
            onPaymentMethodPress={() => openModal(i)}
          />
        </div>
      ))}

      <div className="flex gap-4 mt-6">
        <button
          onClick={addField}
          className="flex-1 border border-gray-300 py-2 font-bold rounded-lg hover:bg-gray-50"
        >
          Supercharge
        </button>
        <button
          onClick={handleFlex}
          className="flex-1 bg-black text-white py-2 font-bold rounded-lg hover:bg-gray-800 transition"
        >
          Flex your payments
        </button>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black bg-opacity-50 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
            />
            <motion.div
              className="fixed inset-x-0 bottom-0 z-50 flex justify-center items-end"
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
            >
              <div className="w-full max-w-md bg-white rounded-t-lg shadow-lg max-h-[75vh] overflow-y-auto p-4">
                <button
                  onClick={() => navigate("/payment-settings")}
                  className="mb-4 bg-black text-white px-4 py-2 rounded-lg"
                >
                  Payment Settings
                </button>
                {paymentData?.data.data
                  .filter((m) => m.type === "card")
                  .map((m, idx, arr) => (
                    <PaymentMethodItem
                      key={m.id}
                      method={m}
                      selectedMethod={
                        activeFieldIndex != null
                          ? selectedFieldPaymentMethods[activeFieldIndex]
                          : selectedPaymentMethod
                      }
                      onSelect={handleMethodSelect}
                      isLastItem={idx === arr.length - 1}
                    />
                  ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <Toaster richColors position="top-right" />
    </div>
  );
};

export default SplitAmountUserCustomization;
