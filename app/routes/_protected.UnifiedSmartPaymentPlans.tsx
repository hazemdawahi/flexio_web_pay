// File: app/routes/UnifiedSmartPaymentPlans.tsx

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "@remix-run/react";
import { toast, Toaster } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

import { useCalculatePaymentPlan } from "~/hooks/useCalculatePaymentPlan";
import { useUserDetails } from "~/hooks/useUserDetails";

import {
  useUnifiedCommerce,
  buildCheckoutRequest,
  buildPaymentRequest,
  buildSendRequest,
  buildAcceptRequest,
  buildAcceptSplitRequest,
  buildVirtualCardRequestWithOptions,
  buildSoteriaPaymentRequest,
  type VirtualCardOptions,
  type SplitPaymentDetail as SplitPaymentDetailDTO,
  type UnifiedCommerceRequest,
  type SendRecipient,
} from "~/hooks/useUnifiedCommerce";

import { usePaymentPlanTerms } from "../hooks/usePaymentPlanTerms";
import { usePaymentMethods, type PaymentMethod } from "~/hooks/usePaymentMethods";

import PaymentMethodItem from "~/compoments/PaymentMethodItem";
import PaymentPlanMocking from "~/compoments/PaymentPlanMocking";
import SelectedPaymentMethod from "~/compoments/SelectedPaymentMethod";
import InterestFreeSheet from "~/compoments/InterestFreeSheet";

type PaymentFrequency = "BI_WEEKLY" | "MONTHLY";

interface SplitEntry {
  userId: string;
  amount: string;
}

interface SuperchargeDetail {
  amount: string;
  paymentMethodId: string;
}

interface SmartPlanOption {
  id: string;
  label: string;
  frequency: PaymentFrequency;
  periods: number;
  description: string;
}

interface UnifiedSmartPaymentPlansProps {
  instantPowerAmount: string;
  superchargeDetails: SuperchargeDetail[];
  otherUserAmounts?: SplitEntry[];
  selectedDiscounts?: string[];
  displayName?: string;
  displayLogo?: string;
}

const ACCENT = "#00BFFF";

const SMART_PLAN_OPTIONS: SmartPlanOption[] = [
  { id: "quick", label: "Quick Pay", frequency: "BI_WEEKLY", periods: 2, description: "Pay off in 4 weeks" },
  { id: "standard", label: "Standard", frequency: "BI_WEEKLY", periods: 4, description: "Pay off in 8 weeks" },
  { id: "extended", label: "Extended", frequency: "MONTHLY", periods: 3, description: "Pay off in 3 months" },
  { id: "max", label: "Maximum Flex", frequency: "MONTHLY", periods: 6, description: "Pay off in 6 months" },
];

const normalizeStr = (v: any, fallback = ""): string => {
  const val = Array.isArray(v) ? (v[0] ?? fallback) : (v ?? fallback);
  if (val === "null" || val === "undefined") return "";
  return typeof val === "string" ? val : fallback;
};

const extractDiscountIds = (raw: string | string[] | undefined): string[] => {
  if (!raw) return [];
  const take = (x: any): string => {
    if (x == null) return "";
    if (typeof x === "string" || typeof x === "number") return String(x).trim();
    if (typeof x === "object") {
      const v = (x as any).id ?? (x as any).discountId ?? (x as any).code ?? "";
      return typeof v === "string" || typeof v === "number" ? String(v).trim() : "";
    }
    return "";
  };
  const uniq = (a: string[]) => Array.from(new Set(a.filter(Boolean)));
  if (Array.isArray(raw)) return uniq(raw.map(take));
  try {
    const parsed = JSON.parse(raw as string);
    if (Array.isArray(parsed)) return uniq(parsed.map(take));
    if (typeof parsed === "string") return uniq(parsed.split(",").map((s) => s.trim()));
  } catch {
    return uniq(String(raw).split(",").map((s) => s.trim()));
  }
  return [];
};

const CenterSpinner: React.FC = () => (
  <div className="min-h-[40vh] w-full flex items-center justify-center bg-white">
    <motion.div
      role="status"
      aria-label="Loading"
      className="w-10 h-10 rounded-full border-4 border-gray-300"
      style={{ borderTopColor: "#000" }}
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, ease: "linear", duration: 0.9 }}
    />
  </div>
);

const ALLOWED_TYPES = [
  "CHECKOUT",
  "PAYMENT",
  "SEND",
  "ACCEPT_REQUEST",
  "ACCEPT_SPLIT_REQUEST",
  "VIRTUAL_CARD",
  "SOTERIA_PAYMENT",
] as const;
type AllowedType = (typeof ALLOWED_TYPES)[number];

const getSession = (key: string): string | null => {
  try {
    if (typeof window === "undefined") return null;
    return window.sessionStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

const setSession = (key: string, value: string) => {
  try {
    if (typeof window === "undefined") return;
    window.sessionStorage?.setItem(key, value);
  } catch {}
};

const UnifiedSmartPaymentPlans: React.FC<UnifiedSmartPaymentPlansProps> = ({
  instantPowerAmount,
  superchargeDetails,
  otherUserAmounts = [],
  selectedDiscounts = [],
  displayName,
  displayLogo,
}) => {
  const navigate = useNavigate();
  const { search } = useLocation();
  const qs = new URLSearchParams(search);

  const merchantId = normalizeStr(qs.get("merchantId"), "");
  const splitFlag = normalizeStr(qs.get("split"), "");
  const modeSplit = splitFlag === "true";

  const powerModeParam = (normalizeStr(qs.get("powerMode"), "INSTANT").toUpperCase() || "INSTANT") as
    | "INSTANT"
    | "YEARLY";
  const isYearlyMode = powerModeParam === "YEARLY";

  const discountListRawQS = normalizeStr(qs.get("discountList"), "");
  const requestId = normalizeStr(qs.get("requestId"), "");
  const transactionTypeParam = normalizeStr(qs.get("transactionType"), "").toUpperCase();

  const transactionType: AllowedType | null = (ALLOWED_TYPES as readonly string[]).includes(
    transactionTypeParam as AllowedType
  )
    ? (transactionTypeParam as AllowedType)
    : null;

  const paymentPlanId = normalizeStr(qs.get("paymentPlanId"), "") || undefined;
  const paymentSchemeId = normalizeStr(qs.get("paymentSchemeId"), "") || undefined;
  const splitPaymentId = normalizeStr(qs.get("splitPaymentId"), "") || undefined;

  const recipientJson = normalizeStr(qs.get("recipient"), "");
  const recipientObj: SendRecipient | null = (() => {
    if (!recipientJson) return null;
    try {
      const x = JSON.parse(recipientJson);
      const rid = String(x?.recipientId || "");
      const amt = Number(x?.amount || 0);
      if (!rid || !Number.isFinite(amt) || amt <= 0) return null;
      return { recipientId: rid, amount: amt } as SendRecipient;
    } catch {
      return null;
    }
  })();

  const parseMoneyLike = (raw: string): number | undefined => {
    const s = (raw || "").trim();
    if (!s) return undefined;
    try {
      const j = JSON.parse(s);
      if (j && typeof j === "object") {
        const a = (j.amount ?? j.value ?? j.total ?? "") as any;
        const n = Number(a);
        return Number.isFinite(n) ? n : undefined;
      }
    } catch {
      const n = Number(s);
      if (Number.isFinite(n)) return n;
    }
    return undefined;
  };
  const totalAmountParam = parseMoneyLike(normalizeStr(qs.get("totalAmount"), ""));

  const displayedInstant = Number(parseFloat(instantPowerAmount).toFixed(2)) || 0;

  // ✅ Calculate supercharge total (parity with mobile)
  const totalSupercharge = useMemo(
    () =>
      (superchargeDetails ?? []).reduce((acc, d) => {
        const n = Number(d?.amount ?? 0);
        return acc + (Number.isFinite(n) ? n : 0);
      }, 0),
    [superchargeDetails]
  );

  const amount = Number(displayedInstant.toFixed(2));

  // ✅ Total with supercharge (for display)
  const totalWithSupercharge = amount + totalSupercharge;

  const { data: userDetailsData } = useUserDetails();
  const currentUserId: string | undefined = userDetailsData?.data?.user?.id;
  const availableIF: number = Number(userDetailsData?.data?.interestFreeCreditAmount ?? 0);

  const {
    data: methods = [],
    isLoading: methodsLoading,
    isError: methodsError,
  } = usePaymentMethods(currentUserId);

  const { mutate: calculatePlan, data: calculatedPlan } = useCalculatePaymentPlan();
  const { mutateAsync: runUnified, isPending: unifiedPending } = useUnifiedCommerce();

  // ✅ Smart plan selection state
  const [selectedPlan, setSelectedPlan] = useState<SmartPlanOption>(SMART_PLAN_OPTIONS[1]);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [interestFreeUsed, setInterestFreeUsed] = useState<number>(0);
  const [freeInput, _setFreeInput] = useState<string>("");
  const setFreeInput = useCallback((v: string) => _setFreeInput(v), [_setFreeInput]);
  const [isIFOpen, setIsIFOpen] = useState<boolean>(false);

  const [planPending, setPlanPending] = useState<boolean>(true);
  const [planExplicitlyEmpty, setPlanExplicitlyEmpty] = useState<boolean>(false);

  useEffect(() => {
    const cards = (methods ?? []).filter((m) => m.type === "card");
    if (!cards.length || selectedPaymentMethod) return;
    const primaryCard = cards.find((m) => m.card?.primary === true);
    setSelectedPaymentMethod(primaryCard ?? cards[0]);
  }, [methods, selectedPaymentMethod]);

  const otherUsersNormalized = useMemo(() => {
    return (otherUserAmounts ?? [])
      .map((u) => ({
        userId: String(u?.userId ?? ""),
        amount: Number(parseFloat(u?.amount ?? "0") || 0),
      }))
      .filter((u) => !!u.userId && Number.isFinite(u.amount) && u.amount >= 0);
  }, [otherUserAmounts]);

  const isSplitFlow = otherUsersNormalized.length > 0;

  const parsedDiscountIds = useMemo(() => {
    const fromProps = extractDiscountIds(selectedDiscounts);
    const fromQS = extractDiscountIds(discountListRawQS || undefined);
    return Array.from(new Set([...fromProps, ...fromQS]));
  }, [selectedDiscounts, discountListRawQS]);
  const hasDiscounts = parsedDiscountIds.length > 0;

  // ✅ Plan request based on selected smart plan
  const planRequest = useMemo(
    () => ({
      frequency: selectedPlan.frequency,
      numberOfPayments: selectedPlan.periods,
      purchaseAmount: amount,
      startDate,
      selfPay: false,
      instantaneous: !isYearlyMode,
      yearly: isYearlyMode,
      interestFreeAmt: Number(interestFreeUsed.toFixed(2)),
    }),
    [selectedPlan, amount, startDate, interestFreeUsed, isYearlyMode]
  );

  useEffect(() => {
    if (amount <= 0) {
      setPlanPending(false);
      setPlanExplicitlyEmpty(false);
      return;
    }
    setPlanPending(true);
    setPlanExplicitlyEmpty(false);

    calculatePlan(planRequest, {
      onSuccess: (res: any) => {
        const empty =
          !res?.data || !Array.isArray(res?.data?.splitPayments) || res?.data?.splitPayments.length === 0;
        setPlanExplicitlyEmpty(empty);
        setPlanPending(false);
      },
      onError: () => {
        toast.error("Could not calculate plan.");
        setPlanExplicitlyEmpty(false);
        setPlanPending(false);
      },
    });
  }, [planRequest, calculatePlan, amount]);

  const today = new Date().toISOString().split("T")[0];
  const hasDueToday = calculatedPlan?.data?.splitPayments?.some((p: any) => p?.dueDate === today) ?? false;

  const buildSplits = useCallback((plan: any | null): SplitPaymentDetailDTO[] => {
    if (!plan?.splitPayments) return [];
    return plan.splitPayments.map((p: any) => ({
      dueDate: p?.dueDate,
      amount: Number(p?.amount ?? 0),
      originalAmount: Number(p?.originalAmount ?? 0),
      interestFreeSlice: Number(p?.interestFreeSlice ?? 0),
      interestRate: Number(p?.interestRate ?? 0),
      interestAmount: Number(p?.interestAmount ?? 0),
      originalInterestAmount: Number(p?.originalInterestAmount ?? 0),
    }));
  }, []);

  type CommonWithDiscounts = {
    paymentFrequency?: any;
    numberOfPayments?: number;
    offsetStartDate?: string;
    instantAmount?: number;
    yearlyAmount?: number;
    selectedPaymentMethod?: string;
    superchargeDetails?: { amount: number; paymentMethodId: string }[];
    splitSuperchargeDetails?: { amount: number; paymentMethodId: string }[];
    selfPayActive?: boolean;
    totalPlanAmount?: number;
    interestFreeUsed?: number;
    interestRate?: number;
    apr?: number;
    originalTotalInterest?: number;
    currentTotalInterest?: number;
    schemeAmount?: number;
    schemeTotalAmount?: number;
    splitPaymentsList?: SplitPaymentDetailDTO[];
    otherUsers?: { userId: string; amount: number }[];
    discountIds?: string[];
  };

  const buildCommonFields = useCallback(
    (plan: any | null): CommonWithDiscounts => {
      const splits = buildSplits(plan);

      const mappedSupercharges = (superchargeDetails || []).map((s) => ({
        amount: Number(s.amount),
        paymentMethodId: s.paymentMethodId,
      }));

      const schemeTotalAmount = Number(totalWithSupercharge.toFixed(2));

      const others = isSplitFlow
        ? otherUsersNormalized.map((u) => ({
            userId: u.userId,
            amount: Number(u.amount) || 0,
          }))
        : undefined;

      const discountIds = hasDiscounts ? parsedDiscountIds : undefined;

      const origTI = Number(plan?.originalTotalInterest);
      const currTI = Number(plan?.currentTotalInterest);
      const haveOrigTI = Number.isFinite(origTI);
      const haveCurrTI = Number.isFinite(currTI);

      const common: CommonWithDiscounts = {
        paymentFrequency: selectedPlan.frequency,
        numberOfPayments: splits.length || selectedPlan.periods || 1,
        offsetStartDate: startDate,
        instantAmount: !isYearlyMode ? Number(amount.toFixed(2)) : 0,
        yearlyAmount: isYearlyMode ? Number(amount.toFixed(2)) : 0,
        selectedPaymentMethod: selectedPaymentMethod?.id,
        superchargeDetails: mappedSupercharges,
        splitSuperchargeDetails: [],
        selfPayActive: false,
        totalPlanAmount: Number((calculatedPlan?.data?.totalAmount ?? amount).toFixed(2)),
        interestFreeUsed: Number(interestFreeUsed.toFixed(2)),
        interestRate: Number(calculatedPlan?.data?.periodInterestRate ?? 0),
        apr: Number(calculatedPlan?.data?.apr ?? 0),
        schemeAmount: schemeTotalAmount,
        schemeTotalAmount,
        splitPaymentsList: splits,
        otherUsers: others,
        discountIds,
      };

      if (haveOrigTI) common.originalTotalInterest = origTI;
      if (haveCurrTI) common.currentTotalInterest = currTI;

      return common;
    },
    [
      buildSplits,
      superchargeDetails,
      totalWithSupercharge,
      isSplitFlow,
      otherUsersNormalized,
      selectedPlan,
      startDate,
      selectedPaymentMethod?.id,
      calculatedPlan?.data?.totalAmount,
      calculatedPlan?.data?.periodInterestRate,
      calculatedPlan?.data?.apr,
      hasDiscounts,
      parsedDiscountIds,
      interestFreeUsed,
      isYearlyMode,
      amount,
      calculatedPlan?.data,
    ]
  );

  const buildVirtualCardOptions = useCallback((): VirtualCardOptions => {
    return {};
  }, []);

  function sanitizeForType<T extends Record<string, any>>(type: AllowedType, req: T): T {
    const out: any = { ...req, type };
    if (type === "PAYMENT") {
      delete out.checkout;
      delete out.card;
      delete out.virtualCard;
      delete out.soteriaPayload;
      delete out.soteriaPaymentTotalAmount;
    }
    if (type === "CHECKOUT") {
      delete out.paymentId;
      delete out.paymentTotalAmount;
      delete out.card;
      delete out.virtualCard;
      delete out.soteriaPayload;
      delete out.soteriaPaymentTotalAmount;
    }
    if (type === "SEND" || type === "ACCEPT_REQUEST" || type === "ACCEPT_SPLIT_REQUEST") {
      delete out.checkout;
      delete out.card;
      delete out.virtualCard;
      delete out.paymentId;
      delete out.paymentTotalAmount;
      delete out.soteriaPayload;
      delete out.soteriaPaymentTotalAmount;
    }
    if (type === "VIRTUAL_CARD") {
      delete out.checkout;
      delete out.paymentId;
      delete out.paymentTotalAmount;
      delete out.soteriaPayload;
      delete out.soteriaPaymentTotalAmount;
    }
    if (type === "SOTERIA_PAYMENT") {
      delete out.checkout;
      delete out.card;
      delete out.virtualCard;
      delete out.paymentId;
    }
    if (out.checkout && Object.keys(out.checkout).length === 0) delete out.checkout;
    if (out.card && Object.keys(out.card).length === 0) delete out.card;
    if (out.virtualCard && Object.keys(out.virtualCard ?? {}).length === 0) delete out.virtualCard;
    return out as T;
  }

  const logUnifiedPayload = useCallback((op: AllowedType, req: UnifiedCommerceRequest) => {
    try {
      const clone = JSON.parse(JSON.stringify(req));
      const json = JSON.stringify(clone, null, 2);
      console.log(`[UnifiedSmartPaymentPlans/web] Sending ${op} request:\n${json}`);
    } catch {
      console.log(`[UnifiedSmartPaymentPlans/web] Sending ${op} request (stringify failed).`, req);
    }
  }, []);

  const displayTotal: number = Number((calculatedPlan?.data?.totalAmount ?? totalAmountParam ?? amount).toFixed(2));

  const navigateSuccess = (amt: number | string, checkoutToken?: string) => {
    const num = typeof amt === "number" ? amt : Number(amt || 0);
    const amountText = Number.isFinite(num) ? num.toFixed(2) : "0.00";
    const params = new URLSearchParams({
      amount: amountText,
      replace_to_index: "1",
      split: isSplitFlow ? "true" : "false",
    });
    if (checkoutToken) params.set("checkoutToken", checkoutToken);
    navigate(`/SuccessPayment?${params.toString()}`);
  };

  const handleConfirm = async () => {
    if (!transactionType) {
      toast.info("Missing transactionType param.");
      return;
    }
    if (!merchantId && transactionType !== "SEND") {
      toast.info("Missing merchantId.");
      return;
    }
    if (!calculatedPlan?.data && transactionType !== "SEND" && transactionType !== "SOTERIA_PAYMENT") {
      toast.info("Wait for plan calculation to finish.");
      return;
    }
    if (
      !selectedPaymentMethod &&
      transactionType !== "ACCEPT_REQUEST" &&
      transactionType !== "ACCEPT_SPLIT_REQUEST" &&
      transactionType !== "SEND" &&
      transactionType !== "SOTERIA_PAYMENT"
    ) {
      toast.info("Select a payment method.");
      return;
    }

    try {
      switch (transactionType) {
        case "VIRTUAL_CARD": {
          const common: any = buildCommonFields(calculatedPlan?.data);
          const virtualCard: VirtualCardOptions = buildVirtualCardOptions();
          let req = buildVirtualCardRequestWithOptions(merchantId, virtualCard, common);
          req = sanitizeForType("VIRTUAL_CARD", req);
          logUnifiedPayload("VIRTUAL_CARD", req);
          await runUnified(req);

          if (isSplitFlow) {
            navigateSuccess(displayTotal);
            break;
          }
          navigate("/card-details");
          break;
        }

        case "CHECKOUT": {
          const common: any = buildCommonFields(calculatedPlan?.data);
          const sessionCheckoutToken = getSession("checkoutToken");

          let req = buildCheckoutRequest(
            {
              checkoutMerchantId: merchantId,
              checkoutType: "ONLINE",
              checkoutRedirectUrl: null,
              checkoutReference: null,
              checkoutDetails: null,
              checkoutToken: sessionCheckoutToken ?? null,
            },
            common
          );

          if (common.otherUsers && !("otherUsers" in (req as any))) {
            (req as any).otherUsers = common.otherUsers;
          }

          req = sanitizeForType("CHECKOUT", req);
          logUnifiedPayload("CHECKOUT", req);
          const res = await runUnified(req);

          const token =
            res?.checkout?.checkoutToken ??
            res?.checkout?.token ??
            (res as any)?.checkoutToken ??
            (res as any)?.token ??
            undefined;

          if (token) {
            try {
              setSession("checkoutToken", String(token));
            } catch {}
          }

          navigateSuccess(displayTotal, token);
          break;
        }

        case "PAYMENT": {
          const common: any = buildCommonFields(calculatedPlan?.data);
          let req = buildPaymentRequest(
            {
              merchantId,
              paymentTotalAmount: { amount: Number(totalWithSupercharge.toFixed(2)), currency: "USD" },
            },
            common as any
          );
          req = sanitizeForType("PAYMENT", req);
          logUnifiedPayload("PAYMENT", req);
          await runUnified(req);
          navigateSuccess(displayTotal);
          break;
        }

        case "SEND": {
          if (!recipientObj) {
            toast.info("Provide a valid single recipient JSON.");
            return;
          }
          const common: any = buildCommonFields(calculatedPlan?.data);
          let req = buildSendRequest(recipientObj, { senderId: "", note: "Transfer" }, common);
          req = sanitizeForType("SEND", req);
          logUnifiedPayload("SEND", req);
          await runUnified(req);
          navigateSuccess(Number(recipientObj.amount));
          break;
        }

        case "ACCEPT_REQUEST": {
          if (!requestId) {
            toast.info("Missing requestId for ACCEPT_REQUEST.");
            return;
          }
          const common: any = buildCommonFields(calculatedPlan?.data);
          let req = buildAcceptRequest(requestId, common);
          req = sanitizeForType("ACCEPT_REQUEST", req);
          logUnifiedPayload("ACCEPT_REQUEST", req);
          await runUnified(req);
          navigateSuccess(displayTotal);
          break;
        }

        case "ACCEPT_SPLIT_REQUEST": {
          if (!requestId) {
            toast.info("Missing requestId for ACCEPT_SPLIT_REQUEST.");
            return;
          }
          const common: any = buildCommonFields(calculatedPlan?.data);
          let req = buildAcceptSplitRequest(requestId, common);
          req = sanitizeForType("ACCEPT_SPLIT_REQUEST", req);
          logUnifiedPayload("ACCEPT_SPLIT_REQUEST", req);
          await runUnified(req);
          navigateSuccess(displayTotal);
          break;
        }

        case "SOTERIA_PAYMENT": {
          if (!paymentPlanId || !splitPaymentId) {
            toast.error(!paymentPlanId ? "paymentPlanId is required." : "splitPaymentId is required.");
            return;
          }
          const common: any = buildCommonFields(calculatedPlan?.data);
          const soteriaPayload = {
            paymentPlanId,
            ...(paymentSchemeId ? { paymentSchemeId } : {}),
            splitPaymentId,
          };
          let req = buildSoteriaPaymentRequest(
            {
              merchantId,
              soteriaPaymentTotalAmount: { amount: Number(totalWithSupercharge.toFixed(2)), currency: "USD" },
              paymentTotalAmount: { amount: Number(totalWithSupercharge.toFixed(2)), currency: "USD" },
              ...(paymentPlanId ? { paymentPlanId } : {}),
              ...(paymentSchemeId ? { paymentSchemeId } : {}),
              ...(splitPaymentId ? { splitPaymentId } : {}),
              soteriaPayload,
            },
            common
          );
          req = sanitizeForType("SOTERIA_PAYMENT", req);
          logUnifiedPayload("SOTERIA_PAYMENT", req);
          await runUnified(req);
          navigateSuccess(displayTotal);
          break;
        }
      }
    } catch (e: any) {
      console.error("Unified error:", e?.message || e);
      toast.error("Operation failed. Try again.");
    }
  };

  const uiPayments = useMemo(
    () =>
      calculatedPlan?.data?.splitPayments?.map((p: any) => ({
        amount: Number(Number(p?.amount ?? 0).toFixed(2)),
        dueDate: p?.dueDate,
        percentage: p?.percentage,
      })) ?? [],
    [calculatedPlan]
  );

  if (methodsLoading) return <CenterSpinner />;

  const showNoPlan = !planPending && planExplicitlyEmpty && amount > 0;

  const applyFree = () => {
    const val = Math.min(Number(freeInput || "0") || 0, availableIF, displayTotal);
    setInterestFreeUsed(val);
    setIsIFOpen(false);
  };

  return (
    <>
      <div className="flex flex-col p-4 bg-white min-h-screen">
        <h1 className="text-2xl font-bold mb-6">
          {`${displayName ? `${displayName} — ` : ""}Smart Plans $${displayTotal.toFixed(2)}`}
        </h1>

        {/* ✅ Supercharge Summary Container (parity with mobile) */}
        {totalSupercharge > 0 && (
          <div className="bg-sky-50 p-3 rounded-lg mb-4 border border-sky-200">
            <p className="text-sm text-sky-700 font-medium">
              Supercharge: ${totalSupercharge.toFixed(2)} • Total: ${totalWithSupercharge.toFixed(2)}
            </p>
          </div>
        )}

        {/* ✅ Smart Plan Selection Cards */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-3">Choose a Plan</h2>
          <div className="grid grid-cols-2 gap-3">
            {SMART_PLAN_OPTIONS.map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelectedPlan(plan)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  selectedPlan.id === plan.id ? "border-sky-500 bg-sky-50" : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <p className="font-semibold text-sm">{plan.label}</p>
                <p className="text-xs text-gray-500 mt-1">{plan.description}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {plan.periods}x {plan.frequency === "BI_WEEKLY" ? "bi-weekly" : "monthly"}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Plan preview */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-3">Payment plan</h2>

          {planPending ? (
            <CenterSpinner />
          ) : showNoPlan ? (
            <div className="w-full py-10 flex items-center justify-center">
              <p className="text-gray-600">No plan available.</p>
            </div>
          ) : uiPayments.length > 0 ? (
            <PaymentPlanMocking
              payments={uiPayments}
              totalAmount={displayTotal}
              showChangeDateButton
              isCollapsed={false}
              initialDate={new Date(startDate)}
              onDateSelected={(d) => setStartDate(d.toISOString().split("T")[0])}
              interestFreeEnabled={true}
              interestFreeUsed={Number(interestFreeUsed.toFixed(2))}
              interestRate={Number(calculatedPlan?.data?.periodInterestRate ?? 0)}
              apr={Number(calculatedPlan?.data?.apr ?? 0)}
              onInterestFreePress={() => setIsIFOpen(true)}
            />
          ) : (
            <div />
          )}
        </div>

        {/* Payment method */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-3">Payment method</h2>
          {methodsError ? (
            <p className="text-red-500">Error fetching methods.</p>
          ) : (
            <SelectedPaymentMethod selectedMethod={selectedPaymentMethod} onPress={() => setIsModalOpen(true)} />
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            disabled={
              !(
                transactionType != null &&
                ((!!calculatedPlan?.data || transactionType === "SEND" || transactionType === "SOTERIA_PAYMENT") &&
                  (transactionType === "ACCEPT_REQUEST" ||
                  transactionType === "ACCEPT_SPLIT_REQUEST" ||
                  transactionType === "SEND" ||
                  transactionType === "SOTERIA_PAYMENT"
                    ? true
                    : !!selectedPaymentMethod) &&
                  !unifiedPending)
              )
            }
            onClick={handleConfirm}
            className={`flex-1 py-3 rounded-lg font-bold text-white ${unifiedPending ? "bg-gray-500" : "bg-black hover:bg-gray-800"}`}
          >
            {unifiedPending ? "Processing…" : hasDueToday ? "Pay & Finish" : "Finish"}
          </button>
        </div>
      </div>

      {/* Payment method picker modal */}
      <AnimatePresence>
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
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center p-4 border-b">
                  <h3 className="font-bold">Select payment method</h3>
                </div>

                <div className="p-4 space-y-4">
                  {(methods ?? [])
                    .filter((m: PaymentMethod) => m.type === "card")
                    .map((method: PaymentMethod) => (
                      <PaymentMethodItem
                        key={method.id}
                        method={method}
                        selectedMethod={selectedPaymentMethod} // ✅ no fake {} as PaymentMethod
                        onSelect={(m) => {
                          setSelectedPaymentMethod(m);
                          setIsModalOpen(false);
                        }}
                        GREEN_COLOR={ACCENT}
                      />
                    ))}
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <InterestFreeSheet
        open={isIFOpen}
        onClose={() => setIsIFOpen(false)}
        availableIF={availableIF}
        originalAmount={displayTotal}
        freeInput={freeInput}
        setFreeInput={setFreeInput}
        applyFree={applyFree}
      />

      <Toaster richColors position="top-right" />
    </>
  );
};

export default UnifiedSmartPaymentPlans;
