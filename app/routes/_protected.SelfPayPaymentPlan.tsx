// app/routes/SelfPayPaymentPlan.tsx

import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useLocation, useNavigate } from "@remix-run/react";
import { usePaymentMethods, PaymentMethod } from "~/hooks/usePaymentMethods";
import {
  useCalculatePaymentPlan,
  SplitPayment,
} from "~/hooks/useCalculatePaymentPlan";
import { useUserDetails } from "~/hooks/useUserDetails";
import { useAvailableDiscounts } from "~/hooks/useAvailableDiscounts";
import { useMerchantDetail } from "~/hooks/useMerchantDetail";
import { toast, Toaster } from "sonner";
import SelectedPaymentMethod from "~/compoments/SelectedPaymentMethod";
import PaymentPlanMocking from "~/compoments/PaymentPlanMocking";
import PaymentMethodItem from "~/compoments/PaymentMethodItem";
import { motion, AnimatePresence } from "framer-motion";
import {
  useCompleteCheckout,
  CompleteCheckoutPayload,
} from "~/hooks/useCompleteCheckout";
import { useCheckoutDetail } from "~/hooks/useCheckoutDetail";

export interface SplitEntry {
  userId: string;
  amount: string;
}

export interface PlansData {
  paymentMethodId: string;
  otherUserAmounts: SplitEntry[];
  selectedDiscounts: string[];
}

type PaymentFrequency = "BIWEEKLY" | "MONTHLY";

const SelfPayPaymentPlan: React.FC<Partial<PlansData>> = (props) => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const {
    paymentMethodId: initialPaymentMethodId,
    otherUserAmounts = [],
    selectedDiscounts: initialDiscounts = [],
  } = { ...(state as Partial<PlansData>), ...props } as PlansData;

  // --- Checkout & User ---
  const checkoutToken =
    typeof window !== "undefined"
      ? sessionStorage.getItem("checkoutToken") || ""
      : "";
  const {
    data: checkoutData,
    isLoading: checkoutLoading,
    error: checkoutError,
  } = useCheckoutDetail(checkoutToken);
  const { data: userDetailsData } = useUserDetails();
  const currentUserId = userDetailsData?.data?.user?.id;

  // --- Merchant Detail (for logo) ---
  const merchantId = checkoutData?.checkout?.merchant?.id || "";
  const { data: merchantDetailData } = useMerchantDetail(merchantId);
  const baseUrl = "http://192.168.1.32:8080";

  // --- Determine Base Amount ---
  const rawTotal = checkoutData?.checkout?.totalAmount.amount ?? "0.00";
  let usedAmountStr = rawTotal;
  if (otherUserAmounts.length && currentUserId) {
    const me = otherUserAmounts.find((e) => e.userId === currentUserId);
    if (me?.amount) usedAmountStr = me.amount;
  }
  const displayedCheckoutTotal = parseFloat(usedAmountStr) || 0;

  // --- Discounts ---
  const {
    data: discounts = [],
    isLoading: discountsLoading,
    error: discountsError,
  } = useAvailableDiscounts(merchantId, displayedCheckoutTotal);
  const [selectedDiscounts, setSelectedDiscounts] =
    useState<string[]>(initialDiscounts);

  const getDiscountValue = (d: any): number => {
    if (d.type === "PERCENTAGE_OFF" && d.discountPercentage != null) {
      return displayedCheckoutTotal * (d.discountPercentage / 100);
    } else if (d.discountAmount != null) {
      return d.discountAmount;
    }
    return 0;
  };

  const didAutoPick = useRef(false);
  useEffect(() => {
    if (!didAutoPick.current && discounts.length) {
      const valid = discounts.filter(
        (d) => displayedCheckoutTotal - getDiscountValue(d) >= 0
      );
      if (valid.length) {
        const best = valid.reduce((a, b) =>
          getDiscountValue(b) > getDiscountValue(a) ? b : a
        );
        setSelectedDiscounts([String(best.id)]);
      }
      didAutoPick.current = true;
    }
  }, [discounts, displayedCheckoutTotal]);

  const discountValue = useMemo(() => {
    const id = selectedDiscounts[0];
    const found = discounts.find((d) => String(d.id) === id);
    return found ? getDiscountValue(found) : 0;
  }, [selectedDiscounts, discounts]);

  const handleDiscountChange = (id: string | number) => {
    const sid = String(id);
    setSelectedDiscounts((prev) =>
      prev.includes(sid) ? [] : [sid]
    );
  };

  const discountedTotal = Math.max(
    0,
    displayedCheckoutTotal - discountValue
  );

  // --- Plan Configuration ---
  const [numberOfPeriods, setNumberOfPeriods] = useState("1");
  const [paymentFrequency, setPaymentFrequency] =
    useState<PaymentFrequency>("BIWEEKLY");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethod | null>(null);

  const { data: paymentMethodsData, status: paymentMethodsStatus } =
    usePaymentMethods();
  const {
    mutate: calculatePlan,
    data: calculatedPlan,
    error: calculatePlanError,
  } = useCalculatePaymentPlan();
  const { mutate: completeCheckout, status: checkoutStatus } =
    useCompleteCheckout();

  // --- Compute & Recalculate Plan ---
  const planRequest = useMemo(
    () => ({
      frequency: paymentFrequency,
      numberOfPayments: parseInt(numberOfPeriods, 10),
      purchaseAmount: discountedTotal,
      startDate,
    }),
    [paymentFrequency, numberOfPeriods, discountedTotal, startDate]
  );

  useEffect(() => {
    if (discountedTotal > 0) {
      calculatePlan(planRequest, {
        onError: () =>
          toast.error("Failed to calculate the payment plan."),
      });
    }
  }, [planRequest, calculatePlan, discountedTotal]);

  useEffect(() => {
    if (calculatePlanError) {
      toast.error(
        "Unable to calculate the payment plan. Please try again."
      );
    }
  }, [calculatePlanError]);

  const mockPayments: SplitPayment[] =
    calculatedPlan?.data?.splitPayments?.map((p) => ({
      dueDate: p.dueDate,
      amount: p.amount,
      percentage: Number(
        ((p.amount / discountedTotal) * 100).toFixed(2)
      ),
    })) ?? [];

  // --- Preselect Payment Method ---
  useEffect(() => {
    const methods = paymentMethodsData?.data?.data || [];
    if (methods.length && !selectedPaymentMethod) {
      const found = initialPaymentMethodId
        ? methods.find((m) => m.id === initialPaymentMethodId)
        : undefined;
      setSelectedPaymentMethod(found ?? methods[0]);
    }
  }, [
    paymentMethodsData,
    initialPaymentMethodId,
    selectedPaymentMethod,
  ]);

  const handleMethodSelect = useCallback((m: PaymentMethod) => {
    setSelectedPaymentMethod(m);
    setIsModalOpen(false);
  }, []);

  const renderPaymentMethodSection = () => {
    if (paymentMethodsStatus === "pending") {
      return (
        <div className="flex justify-center items-center">
          <div className="loader ease-linear rounded-full border-8 border-t-8 border-gray-200 h-16 w-16" />
        </div>
      );
    }
    if (paymentMethodsStatus === "error") {
      return (
        <p className="text-red-500">
          Error fetching payment methods
        </p>
      );
    }
    return (
      <SelectedPaymentMethod
        selectedMethod={selectedPaymentMethod}
        onPress={() => setIsModalOpen(true)}
      />
    );
  };

  // --- Tier‐based Frequencies & Options ---
  const tiers = checkoutData?.configuration?.selfPayTiers || [];
  const availablePaymentFrequencies = Array.from(
    new Set(tiers.map((t) => t.termType as PaymentFrequency))
  );
  useEffect(() => {
    if (!availablePaymentFrequencies.includes(paymentFrequency)) {
      setPaymentFrequency(
        availablePaymentFrequencies[0] || "BIWEEKLY"
      );
    }
  }, [availablePaymentFrequencies, paymentFrequency]);

  const getNumberOptions = () => {
    const tierForFreq = tiers.find(
      (t) => t.termType === paymentFrequency
    );
    if (tierForFreq) {
      return Array.from(
        { length: tierForFreq.maxTerm - tierForFreq.minTerm + 1 },
        (_, i) => {
          const v = tierForFreq.minTerm + i;
          return (
            <option key={v} value={v}>
              {v}
            </option>
          );
        }
      );
    }
    const maxDefault =
      paymentFrequency === "BIWEEKLY" ? 52 : 24;
    return Array.from({ length: maxDefault }, (_, i) => (
      <option key={i + 1} value={i + 1}>
        {i + 1}
      </option>
    ));
  };

  const isTierValid = (() => {
    const full = parseFloat(rawTotal);
    const periods = parseInt(numberOfPeriods, 10);
    const tierForFreq = tiers.find(
      (t) => t.termType === paymentFrequency
    );
    if (tierForFreq) {
      const okAmt =
        (parseFloat(tierForFreq.minAmount) === 0 &&
          parseFloat(tierForFreq.maxAmount) === 0) ||
        (full >= parseFloat(tierForFreq.minAmount) &&
          full <= parseFloat(tierForFreq.maxAmount));
      const okTerm =
        periods >= tierForFreq.minTerm &&
        periods <= tierForFreq.maxTerm;
      return okAmt && okTerm;
    }
    return false;
  })();

  // --- Confirm Handler ---
  const handleConfirm = () => {
    if (!selectedPaymentMethod) {
      return void toast.error("Select a payment method first.");
    }
    if (discountedTotal === 0) {
      return void toast.error("Amount must be greater than zero.");
    }
    if (!isTierValid) {
      return void toast.error(
        "Selected periods do not meet tier requirements."
      );
    }

    const payload: CompleteCheckoutPayload = {
      checkoutToken,
      instantAmount: 0,
      yearlyAmount: 0,
      superchargeDetails: [],
      selectedPaymentMethod: selectedPaymentMethod.id,
      paymentFrequency,
      numberOfPayments: parseInt(numberOfPeriods, 10),
      offsetStartDate: startDate,
      otherUsers: otherUserAmounts.map((u) => ({
        userId: u.userId,
        amount: Math.round(parseFloat(u.amount) * 100),
      })),
      discountIds: selectedDiscounts,
      selfPayActive: true,
    };

    completeCheckout(payload, {
      onSuccess: () => {
        toast.success("Payment plan confirmed!");
        navigate(-1);
      },
      onError: () =>
        toast.error("Checkout failed. Please try again."),
    });
  };

  // --- Render states ---
  if (checkoutLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <h1 className="text-2xl font-bold">Loading…</h1>
        <div className="mt-4 animate-spin text-4xl">🔄</div>
      </div>
    );
  }
  if (checkoutError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <h1 className="text-2xl font-bold">
          Error loading checkout
        </h1>
        <p className="mt-2 text-red-600">
          {checkoutError.message}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white p-4 min-h-screen">
        <h1 className="text-2xl font-bold mb-5">
          Self Pay Plan for ${discountedTotal.toFixed(2)}
        </h1>

        {/* Periods & Frequency */}
        <div className="space-y-4 mb-5">
          <div>
            <label
              htmlFor="numberOfPeriods"
              className="block mb-1 text-sm font-medium text-gray-700"
            >
              Number of Periods
            </label>
            <select
              id="numberOfPeriods"
              value={numberOfPeriods}
              onChange={(e) => setNumberOfPeriods(e.target.value)}
              className="w-full p-2 border rounded shadow-sm focus:outline-none focus:ring"
            >
              {getNumberOptions()}
            </select>
          </div>

          {availablePaymentFrequencies.length > 1 && (
            <div>
              <label
                htmlFor="paymentFrequency"
                className="block mb-1 text-sm font-medium text-gray-700"
              >
                Payment Frequency
              </label>
              <select
                id="paymentFrequency"
                value={paymentFrequency}
                onChange={(e) =>
                  setPaymentFrequency(
                    e.target.value as PaymentFrequency
                  )
                }
                className="w-full p-2 border rounded shadow-sm focus:outline-none focus:ring"
              >
                {availablePaymentFrequencies.map((freq) => (
                  <option key={freq} value={freq}>
                    {freq === "BIWEEKLY"
                      ? "Bi-weekly"
                      : "Monthly"}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Plan Preview */}
        <div className="mb-5">
          <h2 className="text-xl font-semibold mb-3">
            Payment Plan
          </h2>
          {calculatedPlan?.data ? (
            <PaymentPlanMocking
              payments={mockPayments}
              showChangeDateButton
              isCollapsed={false}
              initialDate={new Date(startDate)}
              onDateSelected={(date) =>
                setStartDate(
                  date.toISOString().split("T")[0]
                )
              }
            />
          ) : (
            <div className="flex justify-center items-center">
              <div className="loader ease-linear rounded-full border-8 border-t-8 border-gray-200 h-16 w-16" />
            </div>
          )}
        </div>

        {/* Discounts */}
        {discounts.length > 0 && (
          <div className="mb-5">
            <h2 className="text-xl font-semibold mb-3">
              Available Discounts
            </h2>
            {discountsLoading ? (
              <p>Loading discounts…</p>
            ) : discountsError ? (
              <p className="text-red-500">
                Error loading discounts
              </p>
            ) : (
              <ul>
                {discounts.map((d: any) => {
                  const disabled =
                    displayedCheckoutTotal -
                      getDiscountValue(d) <
                    0;
                  const sid = String(d.id);
                  return (
                    <li
                      key={d.id}
                      onClick={() =>
                        !disabled &&
                        handleDiscountChange(d.id)
                      }
                      className={`flex items-center justify-between border p-2 mb-2 rounded cursor-pointer ${
                        disabled
                          ? "opacity-50 cursor-not-allowed"
                          : ""
                      }`}
                    >
                      <div className="flex items-center">
                        {merchantDetailData?.data?.brand
                          ?.displayLogo && (
                          <img
                            src={
                              merchantDetailData.data.brand.displayLogo.startsWith(
                                "http"
                              )
                                ? merchantDetailData.data.brand
                                    .displayLogo
                                : `${baseUrl}${merchantDetailData.data.brand.displayLogo}`
                            }
                            alt={
                              merchantDetailData.data.brand
                                .displayName || ""
                            }
                            className="w-10 h-10 rounded-full object-cover mr-4 border border-gray-300"
                          />
                        )}
                        <div>
                          <p className="font-bold">
                            {d.discountName}
                          </p>
                          <p>
                            {d.type === "PERCENTAGE_OFF"
                              ? `${d.discountPercentage}% off`
                              : `$${d.discountAmount.toFixed(
                                  2
                                )} off`}
                          </p>
                          {d.expiresAt && (
                            <p className="text-sm text-gray-500">
                              Expires:{" "}
                              {new Date(
                                d.expiresAt
                              ).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <input
                        type="radio"
                        name="discount"
                        checked={selectedDiscounts.includes(
                          sid
                        )}
                        disabled={disabled}
                        readOnly
                        className="ml-4 w-4 h-4 accent-blue-600"
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {/* Payment Method */}
        <div className="mb-5">
          <h2 className="text-xl font-semibold mb-3">
            Payment Method
          </h2>
          {renderPaymentMethodSection()}
        </div>

        {/* Confirm */}
        <button
          onClick={handleConfirm}
          disabled={
            !selectedPaymentMethod ||
            discountedTotal === 0 ||
            !isTierValid
          }
          className={`w-full py-3 font-bold text-white rounded-lg ${
            !selectedPaymentMethod ||
            discountedTotal === 0 ||
            !isTierValid
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-black hover:bg-gray-800"
          }`}
        >
          {checkoutStatus === "pending" ? (
            <div className="flex items-center justify-center">
              <div className="loader ease-linear rounded-full border-4 border-t-4 border-white h-6 w-6 mr-2" />
              Processing…
            </div>
          ) : (
            `Self Pay $${discountedTotal.toFixed(2)}`
          )}
        </button>
      </div>

      {/* Payment Method Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black bg-opacity-50 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div
              className="fixed inset-x-0 bottom-0 z-50 flex justify-center items-end sm:items-center"
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                className="w-full sm:max-w-md bg-white rounded-t-lg sm:rounded-lg shadow-lg max-h-3/4 overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "100%", opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex justify-end p-4">
                  <button
                    onClick={() =>
                      navigate("/payment-settings")
                    }
                    className="bg-black text-white font-bold py-2 px-4 rounded-lg"
                  >
                    Payment Settings
                  </button>
                </div>
                <h2 className="px-4 mb-4 text-xl font-semibold">
                  Select Payment Method
                </h2>
                <div className="space-y-4 px-4 pb-4">
                  {paymentMethodsData?.data?.data
                    ?.filter((m) => m.type === "card")
                    .map((method, idx, arr) => (
                      <PaymentMethodItem
                        key={method.id}
                        method={method}
                        selectedMethod={
                          selectedPaymentMethod
                        }
                        onSelect={handleMethodSelect}
                        isLastItem={
                          idx === arr.length - 1
                        }
                      />
                    ))}
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <Toaster richColors />
    </>
  );
};

export default SelfPayPaymentPlan;
