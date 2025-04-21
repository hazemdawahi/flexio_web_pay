// app/routes/_protected.PaymentPlan.tsx

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "@remix-run/react";
import { usePaymentMethods, PaymentMethod } from "~/hooks/usePaymentMethods";
import { useCalculatePaymentPlan } from "~/hooks/useCalculatePaymentPlan";
import { useUserDetails } from "~/hooks/useUserDetails";
import { useCompleteCheckout, CompleteCheckoutPayload } from "~/hooks/useCompleteCheckout";
import { toast, Toaster } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import PaymentMethodItem from "~/compoments/PaymentMethodItem";
import PaymentPlanMocking from "~/compoments/PaymentPlanMocking";
import SelectedPaymentMethod from "~/compoments/SelectedPaymentMethod";

type PaymentFrequency = "BIWEEKLY" | "MONTHLY";

interface SplitEntry {
  userId: string;
  amount: string; // dollars as string
}

interface SuperchargeDetail {
  amount: string; // dollars as string
  paymentMethodId: string;
}

interface PaymentPlanProps {
  instantPowerAmount: string; // dollars as string
  superchargeDetails: SuperchargeDetail[];
  paymentMethodId?: string;
  otherUserAmounts?: SplitEntry[];
  selectedDiscounts?: string[];
}

const PaymentPlan: React.FC<PaymentPlanProps> = ({
  instantPowerAmount,
  superchargeDetails,
  paymentMethodId,
  otherUserAmounts = [],
  selectedDiscounts = [],
}) => {
  const navigate = useNavigate();
  const { search } = useLocation();
  const modeSplit = new URLSearchParams(search).get("split") === "true";

  // parse dollars
  const displayedInstant =
    Number(parseFloat(instantPowerAmount).toFixed(2)) || 0;
  const totalSupercharge = useMemo(
    () =>
      superchargeDetails.reduce<number>(
        (acc, d) => acc + Number(parseFloat(d.amount) || 0),
        0
      ),
    [superchargeDetails]
  );
  const purchaseAmountDollars = modeSplit
    ? displayedInstant + totalSupercharge
    : displayedInstant;

  // convert to cents for API
  const purchaseAmountCents = Math.round(purchaseAmountDollars * 100);

  // state
  const [numberOfPeriods, setNumberOfPeriods] = useState("1");
  const [paymentFrequency, setPaymentFrequency] =
    useState<PaymentFrequency>("MONTHLY");
  const [startDate, setStartDate] = useState<string>(
    () => new Date().toISOString().split("T")[0]
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethod | null>(null);

  // data hooks
  const { data: paymentMethodsData, status: paymentMethodsStatus } =
    usePaymentMethods();
  const { data: userDetailsData } = useUserDetails();
  const {
    mutate: calculatePlan,
    data: calculatedPlan,
    error: calculateError,
    isPending: planLoading,
  } = useCalculatePaymentPlan();
  const { mutate: completeCheckout, status: checkoutStatus } =
    useCompleteCheckout();

  const checkoutToken = sessionStorage.getItem("checkoutToken");

  // pick default card
  useEffect(() => {
    const cards = paymentMethodsData?.data?.data ?? [];
    if (!cards.length || selectedPaymentMethod) return;
    const firstCard = cards.find((m) => m.type === "card") ?? null;
    if (paymentMethodId) {
      const found = cards.find((m) => m.id === paymentMethodId) ?? firstCard;
      setSelectedPaymentMethod(found);
    } else {
      setSelectedPaymentMethod(firstCard);
    }
  }, [paymentMethodsData, paymentMethodId, selectedPaymentMethod]);

  // build and send plan request whenever inputs change
  const planRequest = useMemo(
    () => ({
      frequency: paymentFrequency,
      numberOfPayments: Number(numberOfPeriods),
      purchaseAmount: purchaseAmountCents,
      startDate,
    }),
    [paymentFrequency, numberOfPeriods, purchaseAmountCents, startDate]
  );

  useEffect(() => {
    if (!purchaseAmountCents) return;
    calculatePlan(planRequest, {
      onError: () => toast.error("Could not calculate plan"),
    });
  }, [planRequest]);

  // map API splitPayments (in cents) back to dollars for UI
  const uiPayments = useMemo(
    () =>
      calculatedPlan?.data?.splitPayments?.map((p) => ({
        amount: Number((p.amount / 100).toFixed(2)),
        dueDate: p.dueDate,
        percentage: p.percentage,
      })) ?? [],
    [calculatedPlan]
  );

  // handlers
  const handleMethodSelect = useCallback((m: PaymentMethod) => {
    setSelectedPaymentMethod(m);
    setIsModalOpen(false);
  }, []);

  const handleConfirm = () => {
    if (!selectedPaymentMethod || purchaseAmountCents <= 0) {
      toast.error("Pick a payment method and amount > 0");
      return;
    }
    if (!checkoutToken) {
      toast.error("Checkout token missing");
      return;
    }

    const payload: CompleteCheckoutPayload = {
      checkoutToken,
      instantAmount: displayedInstant,
      yearlyAmount: 0,
      selectedPaymentMethod: selectedPaymentMethod.id,
      superchargeDetails: superchargeDetails.map((s) => ({
        paymentMethodId: s.paymentMethodId,
        amount: Number(parseFloat(s.amount) || 0),
      })),
      paymentFrequency,
      numberOfPayments: Number(numberOfPeriods),
      offsetStartDate: startDate,
      otherUsers: otherUserAmounts.map((u) => ({
        userId: u.userId,
        amount: Number(parseFloat(u.amount) || 0),
      })),
      discountIds: selectedDiscounts,
      selfPayActive: false,
    };

    completeCheckout(payload, {
      onSuccess: (data) => {
        toast.success("Payment plan confirmed!");
        (window.opener || window.parent || window).postMessage(
          {
            status: otherUserAmounts.length ? "PENDING" : "COMPLETED",
            checkoutToken,
            data,
          },
          "*"
        );
      },
      onError: () => toast.error("Checkout failed"),
    });
  };

  const getMaxNumber = (f: PaymentFrequency) =>
    f === "BIWEEKLY" ? 26 : 12;
  const periodOptions = Array.from(
    { length: getMaxNumber(paymentFrequency) },
    (_, i) => i + 1
  );

  return (
    <>
      <div className="flex flex-col p-4 bg-white min-h-screen">
        <h1 className="text-2xl font-bold mb-6">
          Flex your payments for ${purchaseAmountDollars.toFixed(2)}
        </h1>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">
              Number of periods
            </label>
            <select
              value={numberOfPeriods}
              onChange={(e) => setNumberOfPeriods(e.target.value)}
              className="w-full p-2 border rounded-md shadow-sm focus:ring-black focus:border-black"
            >
              {periodOptions.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">
              Payment frequency
            </label>
            <select
              value={paymentFrequency}
              disabled={numberOfPeriods === "1"}
              onChange={(e) =>
                setPaymentFrequency(e.target.value as PaymentFrequency)
              }
              className={`w-full p-2 border rounded-md shadow-sm focus:ring-black focus:border-black ${
                numberOfPeriods === "1" ? "bg-gray-100" : ""
              }`}
            >
              <option value="BIWEEKLY">Bi‑weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </div>
        </div>

        {!!purchaseAmountDollars && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-3">Payment plan</h2>
            {planLoading ? (
              <div className="flex justify-center">
                <div className="loader h-16 w-16" />
              </div>
            ) : (
              <PaymentPlanMocking
                payments={uiPayments}
                showChangeDateButton
                isCollapsed={false}
                initialDate={new Date(startDate)}
                onDateSelected={(d) =>
                  setStartDate(d.toISOString().split("T")[0])
                }
              />
            )}
          </div>
        )}

        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-3">Payment method</h2>
          {paymentMethodsStatus === "pending" ? (
            <div className="flex justify-center">
              <div className="loader h-16 w-16" />
            </div>
          ) : paymentMethodsStatus === "error" ? (
            <p className="text-red-500">Error fetching methods</p>
          ) : (
            <SelectedPaymentMethod
              selectedMethod={selectedPaymentMethod}
              onPress={() => setIsModalOpen(true)}
            />
          )}
        </div>

        <button
          disabled={purchaseAmountCents <= 0 || checkoutStatus === "pending"}
          onClick={handleConfirm}
          className={`w-full py-3 rounded-lg font-bold text-white ${
            purchaseAmountCents <= 0
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-black hover:bg-gray-800"
          }`}
        >
          {checkoutStatus === "pending"
            ? "Processing…"
            : `Flex $${purchaseAmountDollars.toFixed(2)}`}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {isModalOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black bg-opacity-50 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div
              className="fixed inset-x-0 bottom-0 z-50 flex justify-center items-end sm:items-center"
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
            >
              <motion.div
                className="w-full sm:max-w-md bg-white rounded-t-lg sm:rounded-lg shadow-lg max-h-[75vh] overflow-y-auto"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center p-4 border-b">
                  <h3 className="font-bold">Select payment method</h3>
                  <button
                    onClick={() => navigate("/payment-settings")}
                    className="bg-black text-white px-3 py-1 rounded"
                  >
                    Settings
                  </button>
                </div>
                <div className="p-4 space-y-4">
                  {paymentMethodsData?.data?.data
                    ?.filter((m) => m.type === "card")
                    .map((method, idx) => (
                      <PaymentMethodItem
                        key={method.id}
                        method={method}
                        selectedMethod={selectedPaymentMethod}
                        onSelect={handleMethodSelect}
                        isLastItem={
                          idx === paymentMethodsData.data.data.length - 1
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

export default PaymentPlan;
