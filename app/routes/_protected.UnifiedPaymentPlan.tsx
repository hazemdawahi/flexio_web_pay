// File: src/routes/_protected.UnifiedPaymentPlan.tsx

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "@remix-run/react";
import { toast, Toaster } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

import { useCalculatePaymentPlan } from "~/hooks/useCalculatePaymentPlan";
import { useUserDetails } from "~/hooks/useUserDetails";

// ✅ Unified commerce hook & builders (web analog to RN)
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

import { usePaymentPlanTerms } from "./usePaymentPlanTerms";

// ⬇️ strict per-user payment methods hook (returns PaymentMethod[] directly)
import { usePaymentMethods, type PaymentMethod } from "~/hooks/usePaymentMethods";

// NOTE: keeping your existing compoments pathing
import PaymentMethodItem from "~/compoments/PaymentMethodItem";
import PaymentPlanMocking from "~/compoments/PaymentPlanMocking";
import SelectedPaymentMethod from "~/compoments/SelectedPaymentMethod";
import InterestFreeSheet from "~/compoments/InterestFreeSheet";


/* ─────────────────────────────────────────────────────────────
   Types & small utilities
   ───────────────────────────────────────────────────────────── */

type PaymentFrequency = "BI_WEEKLY" | "MONTHLY";

interface SplitEntry {
  userId: string;
  amount: string; // dollars
}

interface SuperchargeDetail {
  amount: string; // dollars
  paymentMethodId: string;
}

interface UnifiedPaymentPlanProps {
  instantPowerAmount: string; // main amount in DOLLARS
  superchargeDetails: SuperchargeDetail[];
  otherUserAmounts?: SplitEntry[];
  selectedDiscounts?: string[];
  displayName?: string;
  displayLogo?: string;
}

const normalizeStr = (v: any, fallback = ""): string => {
  const val = Array.isArray(v) ? (v[0] ?? fallback) : (v ?? fallback);
  if (val === "null" || val === "undefined") return "";
  return typeof val === "string" ? val : fallback;
};

// Discount canonicalizer → array of ID strings
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
    if (typeof parsed === "string") return uniq(parsed.split(",").map(s => s.trim()));
  } catch {
    return uniq(String(raw).split(",").map(s => s.trim()));
  }
  return [];
};

/** Center spinner */
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

// Allowed Unified operation types (parity with RN)
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

/* ───────────────────────────────────────────────────────────── */

const UnifiedPaymentPlan: React.FC<UnifiedPaymentPlanProps> = ({
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

  // Read RN-like params from URL
  const merchantId = normalizeStr(qs.get("merchantId"), "");
  const splitFlag = normalizeStr(qs.get("split"), "");
  const modeSplit = splitFlag === "true";

  const discountListRawQS = normalizeStr(qs.get("discountList"), "");
  const requestId = normalizeStr(qs.get("requestId"), "");
  const transactionTypeParam = normalizeStr(qs.get("transactionType"), "").toUpperCase();

  const transactionType: AllowedType | null = (ALLOWED_TYPES as readonly string[]).includes(
    transactionTypeParam as AllowedType
  )
    ? (transactionTypeParam as AllowedType)
    : null;

  // Soteria ids
  const paymentPlanId = normalizeStr(qs.get("paymentPlanId"), "") || undefined;
  const paymentSchemeId = normalizeStr(qs.get("paymentSchemeId"), "") || undefined;
  const splitPaymentId = normalizeStr(qs.get("splitPaymentId"), "") || undefined;

  // Recipient JSON for SEND
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

  /* ───── Amount derivation (parity with RN) ───── */
  const displayedInstant = Number(parseFloat(instantPowerAmount).toFixed(2)) || 0;

  const totalSupercharge = useMemo(
    () =>
      (superchargeDetails ?? []).reduce((acc, d) => {
        const n = Number(d?.amount ?? 0);
        return acc + (Number.isFinite(n) ? n : 0);
      }, 0),
    [superchargeDetails]
  );

  // If split intent, include supercharge in header total (RN parity)
  const amount = modeSplit
    ? Number((displayedInstant + totalSupercharge).toFixed(2))
    : Number(displayedInstant.toFixed(2));

  /* ───── Data hooks ───── */
  const { data: userDetailsData } = useUserDetails();
  const currentUserId: string | undefined = userDetailsData?.data?.user?.id;
  const availableIF: number = Number(userDetailsData?.data?.interestFreeCreditAmount ?? 0);

  // strict per-user payment methods; returns PaymentMethod[] directly
  const {
    data: methods = [],
    isLoading: methodsLoading,
    isError: methodsError,
  } = usePaymentMethods(currentUserId);

  const { mutate: calculatePlan, data: calculatedPlan } = useCalculatePaymentPlan();
  const termsMutation = usePaymentPlanTerms();

  // ✅ Unified Commerce mutation
  const { mutateAsync: runUnified, isPending: unifiedPending } = useUnifiedCommerce();

  /* ───── Local UI/state ───── */
  const [paymentFrequency, setPaymentFrequency] = useState<PaymentFrequency>("BI_WEEKLY");
  const [numberOfPeriods, setNumberOfPeriods] = useState("1");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Interest-free state (web parity with mobile)
  const [interestFreeUsed, setInterestFreeUsed] = useState<number>(0);
  const [freeInput, setFreeInput] = useState<string>("");
  const [isIFOpen, setIsIFOpen] = useState<boolean>(false);

  // Section-only spinners
  const [planPending, setPlanPending] = useState<boolean>(true);
  const [termsPending, setTermsPending] = useState<boolean>(false);

  // Explicit empty plan flag
  const [planExplicitlyEmpty, setPlanExplicitlyEmpty] = useState<boolean>(false);

  // Term bounds from server
  const [minTerm, setMinTerm] = useState<number>(1);
  const [maxTerm, setMaxTerm] = useState<number>(12);

  // Default method selection (prefer primary card)
  useEffect(() => {
    const cards = (methods ?? []).filter(m => m.type === "card");
    if (!cards.length || selectedPaymentMethod) return;
    const primaryCard = cards.find(m => m.card?.primary === true);
    setSelectedPaymentMethod(primaryCard ?? cards[0]);
  }, [methods, selectedPaymentMethod]);

  // Normalize other users & exclude current user (RN parity)
  const otherUsersNormalized = useMemo(() => {
    const base = (otherUserAmounts ?? [])
      .map(u => ({
        userId: String(u?.userId ?? ""),
        amount: Number(parseFloat(u?.amount ?? "0") || 0),
      }))
      .filter(u => !!u.userId && Number.isFinite(u.amount) && u.amount >= 0);
    if (!currentUserId) return base;
    return base.filter(u => u.userId !== currentUserId);
  }, [otherUserAmounts, currentUserId]);

  const isSplitFlow = otherUsersNormalized.length > 0;

  // Discounts (merge props + qs; normalize like RN)
  const parsedDiscountIds = useMemo(
    () => {
      const fromProps = extractDiscountIds(selectedDiscounts);
      const fromQS = extractDiscountIds(discountListRawQS || undefined);
      return Array.from(new Set([...fromProps, ...fromQS]));
    },
    [selectedDiscounts, discountListRawQS]
  );
  const hasDiscounts = parsedDiscountIds.length > 0;

  // Fetch dynamic term bounds when amount/frequency changes
  useEffect(() => {
    if (!amount || amount <= 0) {
      setMinTerm(1);
      setMaxTerm(paymentFrequency === "BI_WEEKLY" ? 26 : 12);
      return;
    }

    setTermsPending(true);
    termsMutation.mutate(
      {
        frequency: paymentFrequency,
        purchaseAmount: amount, // dollars
        instantaneous: true,
        yearly: false,
      },
      {
        onSuccess: (res: any) => {
          const newMin = Math.max(1, Number(res?.data?.minTerm ?? 1));
          const newMax = Number(
            res?.data?.maxTerm ?? (paymentFrequency === "BI_WEEKLY" ? 26 : 12)
          );
          setMinTerm(newMin);
          setMaxTerm(newMax);

          // Clamp current selection into new bounds
          const current = parseInt(numberOfPeriods, 10) || newMin;
          const clamped = Math.max(newMin, Math.min(current, newMax));
          if (String(clamped) !== numberOfPeriods) setNumberOfPeriods(String(clamped));
        },
        onError: () => {
          setMinTerm(1);
          setMaxTerm(paymentFrequency === "BI_WEEKLY" ? 26 : 12);
          toast.error("Could not fetch plan terms.");
        },
        onSettled: () => setTermsPending(false),
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, paymentFrequency]);

  // Build request for plan calculation
  const planRequest = useMemo(
    () => {
      const raw = parseInt(numberOfPeriods, 10) || minTerm;
      const count = Math.max(minTerm, Math.min(raw, maxTerm));
      return {
        frequency: paymentFrequency as PaymentFrequency,
        numberOfPayments: count,
        purchaseAmount: amount, // dollars
        startDate,
        selfPay: false,
        instantaneous: true,
        yearly: false,
        interestFreeAmt: Number(interestFreeUsed.toFixed(2)), // ← apply IF
      };
    },
    [paymentFrequency, numberOfPeriods, minTerm, maxTerm, amount, startDate, interestFreeUsed]
  );

  // Calculate plan whenever inputs change
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
          !res?.data ||
          !Array.isArray(res?.data?.splitPayments) ||
          res?.data?.splitPayments.length === 0;
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

  // First-due detection
  const today = new Date().toISOString().split("T")[0];
  const hasDueToday =
    calculatedPlan?.data?.splitPayments?.some((p: any) => p?.dueDate === today) ?? false;

  /* ─────────────────────────────────────────────────────────────
     Unified helpers (parity with RN)
     ───────────────────────────────────────────────────────────── */

  const buildSplits = useCallback(
    (plan: any | null): SplitPaymentDetailDTO[] => {
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
    },
    []
  );

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

      const superchargeSum = (superchargeDetails || []).reduce((acc, s) => {
        const n = Number(s.amount);
        return acc + (isNaN(n) ? 0 : n);
      }, 0);
      const schemeTotalAmount = Number((amount + superchargeSum).toFixed(2));

      const others =
        isSplitFlow
          ? otherUsersNormalized.map(u => ({
              userId: u.userId,
              amount: Number(u.amount) || 0,
            }))
          : undefined;

      const discountIds = hasDiscounts ? parsedDiscountIds : undefined;

      return {
        paymentFrequency,
        numberOfPayments: splits.length || Number(numberOfPeriods) || 1,
        offsetStartDate: startDate,

        instantAmount: Number(amount.toFixed(2)),
        yearlyAmount: 0,

        selectedPaymentMethod: selectedPaymentMethod?.id,

        superchargeDetails: mappedSupercharges,
        splitSuperchargeDetails: [],

        selfPayActive: false,
        totalPlanAmount: Number(((calculatedPlan?.data?.totalAmount ?? amount)).toFixed(2)),
        interestFreeUsed: Number(interestFreeUsed.toFixed(2)),
        interestRate: Number(calculatedPlan?.data?.periodInterestRate ?? 0),
        apr: Number(calculatedPlan?.data?.apr ?? 0),
        schemeTotalAmount,

        splitPaymentsList: splits,
        otherUsers: others,

        discountIds,
      };
    },
    [
      buildSplits,
      superchargeDetails,
      amount,
      isSplitFlow,
      otherUsersNormalized,
      paymentFrequency,
      numberOfPeriods,
      startDate,
      selectedPaymentMethod?.id,
      calculatedPlan?.data?.totalAmount,
      calculatedPlan?.data?.periodInterestRate,
      calculatedPlan?.data?.apr,
      hasDiscounts,
      parsedDiscountIds,
      interestFreeUsed,
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
    if (out.virtualCard && Object.keys(out.virtualCard).length === 0) delete out.virtualCard;
    return out as T;
  }

  const logUnifiedPayload = useCallback((op: AllowedType, req: UnifiedCommerceRequest) => {
    try {
      const clone = JSON.parse(JSON.stringify(req));
      const json = JSON.stringify(clone, null, 2);
      // eslint-disable-next-line no-console
      console.log(`[UnifiedPaymentPlan/web] Sending ${op} request:\n${json}`);
    } catch {
      // eslint-disable-next-line no-console
      console.log(`[UnifiedPaymentPlan/web] Sending ${op} request (stringify failed).`, req);
    }
  }, []);

  /* ─────────────────────────────────────────────────────────────
     Confirm handler — ROUTING UPDATED to /SuccessPayment + amount
     ───────────────────────────────────────────────────────────── */
  const navigateSuccess = (amt: number | string) => {
    const num = typeof amt === "number" ? amt : Number(amt || 0);
    const amountText = Number.isFinite(num) ? num.toFixed(2) : "0.00";
    navigate(`/SuccessPayment?amount=${encodeURIComponent(amountText)}&replace_to_index=1`);
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
            navigateSuccess(amount);
            break;
          }
          navigate("/card-details");
          break;
        }

        case "CHECKOUT": {
          const common: any = buildCommonFields(calculatedPlan?.data);
          let req = buildCheckoutRequest(
            {
              checkoutMerchantId: merchantId,
              checkoutTotalAmount: { amount: Number(amount.toFixed(2)), currency: "USD" },
              checkoutType: "ONLINE",
              checkoutRedirectUrl: null,
              checkoutReference: null,
              checkoutDetails: null,
              checkoutToken: null,
            },
            common
          );
          req = sanitizeForType("CHECKOUT", req);
          logUnifiedPayload("CHECKOUT", req);
          await runUnified(req);
          navigateSuccess(amount);
          break;
        }

        case "PAYMENT": {
          const common: any = buildCommonFields(calculatedPlan?.data);
          let req = buildPaymentRequest(
            {
              merchantId,
              paymentTotalAmount: { amount: Number(amount.toFixed(2)), currency: "USD" },
            },
            common as any
          );
          req = sanitizeForType("PAYMENT", req);
          logUnifiedPayload("PAYMENT", req);
          await runUnified(req);
          navigateSuccess(amount);
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
          navigateSuccess(amount);
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
          navigateSuccess(amount);
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
              soteriaPaymentTotalAmount: { amount: Number(amount.toFixed(2)), currency: "USD" },
              paymentTotalAmount: { amount: Number(amount.toFixed(2)), currency: "USD" }, // compat alias
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
          navigateSuccess(amount);
          break;
        }
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error("Unified error:", e?.message || e);
      toast.error("Operation failed. Try again.");
    }
  };

  /* ---------- Build FULL request for Customize (ALL TYPES) ---------- */
  const buildRequestForCustomize = useCallback((): UnifiedCommerceRequest | null => {
    if (!transactionType) return null;
    if (!calculatedPlan?.data && transactionType !== "SEND" && transactionType !== "SOTERIA_PAYMENT") return null;

    const firstSplit = calculatedPlan?.data?.splitPayments?.[0];
    const firstSplitDueDate = firstSplit?.dueDate ?? startDate;

    switch (transactionType) {
      case "VIRTUAL_CARD": {
        const splits = buildSplits(calculatedPlan?.data);
        const mappedSupercharges = (superchargeDetails || []).map((s) => ({
          amount: Number(s.amount),
          paymentMethodId: s.paymentMethodId,
        }));
        const superchargeSum = (superchargeDetails || []).reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
        const schemeTotalAmount = Number((amount + superchargeSum).toFixed(2));

        const common: any = {
          paymentFrequency,
          numberOfPayments: splits.length || Number(numberOfPeriods) || 1,
          offsetStartDate: firstSplitDueDate,
          instantAmount: Number(amount.toFixed(2)),
          yearlyAmount: 0,
          selectedPaymentMethod: selectedPaymentMethod?.id,
          superchargeDetails: mappedSupercharges,
          splitSuperchargeDetails: [],
          selfPayActive: false,
          totalPlanAmount: Number(((calculatedPlan?.data?.totalAmount ?? amount)).toFixed(2)),
          interestFreeUsed: Number(interestFreeUsed.toFixed(2)),
          interestRate: Number(calculatedPlan?.data?.periodInterestRate ?? 0),
          apr: Number(calculatedPlan?.data?.apr ?? 0),
          schemeTotalAmount,
          splitPaymentsList: splits,
          otherUsers: isSplitFlow
            ? otherUsersNormalized.map(u => ({ userId: u.userId, amount: Number(u.amount) || 0 }))
            : undefined,
          ...(hasDiscounts ? { discountIds: parsedDiscountIds } : {}),
        };

        const virtualCard: VirtualCardOptions = buildVirtualCardOptions();
        let req = buildVirtualCardRequestWithOptions(merchantId, virtualCard, common);
        return sanitizeForType("VIRTUAL_CARD", req);
      }

      case "CHECKOUT": {
        const common: any = { ...buildCommonFields(calculatedPlan?.data), offsetStartDate: firstSplitDueDate };
        let req = buildCheckoutRequest(
          {
            checkoutMerchantId: merchantId,
            checkoutTotalAmount: { amount: Number(amount.toFixed(2)), currency: "USD" },
            checkoutType: "ONLINE",
            checkoutRedirectUrl: null,
            checkoutReference: null,
            checkoutDetails: null,
            checkoutToken: null,
          },
          common
        );
        return sanitizeForType("CHECKOUT", req);
      }

      case "PAYMENT": {
        const common: any = { ...buildCommonFields(calculatedPlan?.data), offsetStartDate: firstSplitDueDate };
        let req = buildPaymentRequest(
          {
            merchantId,
            paymentTotalAmount: { amount: Number(amount.toFixed(2)), currency: "USD" },
          },
          common as any
        );
        return sanitizeForType("PAYMENT", req);
      }

      case "SEND": {
        if (!recipientObj) return null;
        const common: any = { ...buildCommonFields(calculatedPlan?.data), offsetStartDate: firstSplitDueDate };
        let req = buildSendRequest(recipientObj, { senderId: "", note: "Transfer" }, common);
        return sanitizeForType("SEND", req);
      }

      case "ACCEPT_REQUEST": {
        if (!requestId) return null;
        const common: any = { ...buildCommonFields(calculatedPlan?.data), offsetStartDate: firstSplitDueDate };
        let req = buildAcceptRequest(requestId, common);
        return sanitizeForType("ACCEPT_REQUEST", req);
      }

      case "ACCEPT_SPLIT_REQUEST": {
        if (!requestId) return null;
        const common: any = { ...buildCommonFields(calculatedPlan?.data), offsetStartDate: firstSplitDueDate };
        let req = buildAcceptSplitRequest(requestId, common);
        return sanitizeForType("ACCEPT_SPLIT_REQUEST", req);
      }

      case "SOTERIA_PAYMENT": {
        const common: any = { ...buildCommonFields(calculatedPlan?.data), offsetStartDate: firstSplitDueDate };
        const soteriaPayload = {
          ...(paymentPlanId ? { paymentPlanId } : {}),
          ...(paymentSchemeId ? { paymentSchemeId } : {}),
          ...(splitPaymentId ? { splitPaymentId } : {}),
        };
        let req = buildSoteriaPaymentRequest(
          {
            merchantId,
            soteriaPaymentTotalAmount: { amount: Number(amount.toFixed(2)), currency: "USD" },
            paymentTotalAmount: { amount: Number(amount.toFixed(2)), currency: "USD" },
            ...(paymentPlanId ? { paymentPlanId } : {}),
            ...(paymentSchemeId ? { paymentSchemeId } : {}),
            ...(splitPaymentId ? { splitPaymentId } : {}),
            soteriaPayload,
          },
          common
        );
        return sanitizeForType("SOTERIA_PAYMENT", req);
      }
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    transactionType,
    calculatedPlan?.data,
    buildCommonFields,
    buildVirtualCardOptions,
    merchantId,
    amount,
    parsedDiscountIds,
    requestId,
    recipientObj,
    numberOfPeriods,
    startDate,
    hasDiscounts,
    paymentPlanId,
    paymentSchemeId,
    splitPaymentId,
    isSplitFlow,
    otherUsersNormalized,
    paymentFrequency,
    selectedPaymentMethod?.id,
    interestFreeUsed,
  ]);

  // Normalize plan data for UI component
  const uiPayments = useMemo(
    () =>
      calculatedPlan?.data?.splitPayments?.map((p: any) => ({
        amount: Number(Number(p?.amount ?? 0).toFixed(2)),
        dueDate: p?.dueDate,
        percentage: p?.percentage,
      })) ?? [],
    [calculatedPlan]
  );

  // Page-level loading (methods)
  if (methodsLoading) return <CenterSpinner />;

  // Strict “No plan” state
  const showNoPlan = !planPending && planExplicitlyEmpty && amount > 0;

  const canCustomize =
    !!calculatedPlan?.data &&
    (calculatedPlan?.data?.splitPayments?.some((p: any) => p?.dueDate === new Date().toISOString().split("T")[0]) ?? false) &&
    !!transactionType &&
    (
      (transactionType === "VIRTUAL_CARD" && !!selectedPaymentMethod) ||
      (transactionType === "SEND" && !!recipientObj) ||
      (transactionType === "ACCEPT_REQUEST" && !!requestId) ||
      (transactionType === "ACCEPT_SPLIT_REQUEST" && !!requestId) ||
      transactionType === "CHECKOUT" ||
      transactionType === "PAYMENT" ||
      transactionType === "SOTERIA_PAYMENT"
    );

  // Interest-free helpers (mirror mobile)
  const digitsOnly = (s: string) => s.replace(/\D+/g, "");
  const handleFreeChange = (v: string) => setFreeInput(digitsOnly(v));
  const totalAmountResolved = Number(calculatedPlan?.data?.totalAmount ?? amount);
  const freeAmountNum = Number(freeInput || "0");
  const ifDisabled =
    freeAmountNum < 0 || freeAmountNum > availableIF || freeAmountNum > totalAmountResolved;

  const applyFree = () => {
    const val = Math.min(freeAmountNum || 0, availableIF, totalAmountResolved);
    setInterestFreeUsed(val);
    setIsIFOpen(false);
  };

  /* ---------------------------- RENDER ---------------------------- */

  return (
    <>
      <div className="flex flex-col p-4 bg-white min-h-screen">
        <h1 className="text-2xl font-bold mb-6">
          {`${displayName ? `${displayName} — ` : ""}Flex $${Number(
            calculatedPlan?.data?.totalAmount ?? amount
          ).toFixed(2)}`}
        </h1>

        {/* Periods + Frequency */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">
              Number of periods{" "}
              {termsPending && (
                <span className="text-xs text-gray-500">(updating…)</span>
              )}
            </label>
            <select
              value={numberOfPeriods}
              onChange={(e) => setNumberOfPeriods(e.target.value)}
              className="w-full p-2 border rounded-md shadow-sm focus:ring-black focus:border-black"
            >
              {Array.from(
                {
                  length:
                    (maxTerm || (paymentFrequency === "BI_WEEKLY" ? 26 : 12)) -
                    (minTerm || 1) +
                    1,
                },
                (_, i) => i + (minTerm || 1)
              ).map((v) => (
                <option key={v} value={String(v)}>
                  {v}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Allowed: {minTerm}–{maxTerm}{" "}
              {paymentFrequency === "BI_WEEKLY"
                ? "periods (bi-weekly)"
                : "periods (monthly)"}
            </p>
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">
              Payment frequency
            </label>
            <select
              value={paymentFrequency}
              onChange={(e) => setPaymentFrequency(e.target.value as PaymentFrequency)}
              className="w-full p-2 border rounded-md shadow-sm focus:ring-black focus:border-black"
            >
              <option value="BI_WEEKLY">Bi-weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
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
              totalAmount={Number(calculatedPlan?.data?.totalAmount ?? amount)}
              showChangeDateButton
              isCollapsed={false}
              initialDate={new Date(startDate)}
              onDateSelected={(d) => setStartDate(d.toISOString().split("T")[0])}
              interestFreeEnabled={true}
              interestFreeUsed={Number(interestFreeUsed.toFixed(2))}
              interestRate={Number(calculatedPlan?.data?.periodInterestRate ?? 0)}
              apr={Number(calculatedPlan?.data?.apr ?? 0)}
              onInterestFreePress={() => setIsIFOpen(true)} // ← opens the sheet
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
            <SelectedPaymentMethod
              selectedMethod={selectedPaymentMethod}
              onPress={() => setIsModalOpen(true)}
            />
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          {/* Customize */}
          {canCustomize && (
            <button
              onClick={() => {
                const req = buildRequestForCustomize();
                if (!req) {
                  toast.error("Could not build customize request");
                  return;
                }
                try {
                  if (typeof window !== "undefined") {
                    sessionStorage.setItem(
                      "unified_customize_payload",
                      JSON.stringify(req)
                    );
                  }
                } catch {}
                const data = encodeURIComponent(JSON.stringify(req));
                navigate(`/UnifiedPayCustomizeScreen?data=${data}`);
              }}
              className="flex-1 border border-gray-300 rounded-lg py-3 font-bold"
            >
              Customize
            </button>
          )}

          {/* Confirm */}
          <button
            disabled={
              !(
                transactionType != null &&
                ((!!calculatedPlan?.data ||
                  transactionType === "SEND" ||
                  transactionType === "SOTERIA_PAYMENT") &&
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
            className={`flex-1 py-3 rounded-lg font-bold text-white ${
              unifiedPending ? "bg-gray-500" : "bg-black hover:bg-gray-800"
            }`}
          >
            {unifiedPending
              ? "Processing…"
              : hasDueToday
              ? "Pay & Finish"
              : "Finish"}
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
                  <button
                    onClick={() => navigate("/payment-settings")}
                    className="bg-black text-white px-3 py-1 rounded"
                  >
                    Settings
                  </button>
                </div>

                <div className="p-4 space-y-4">
                  {(methods ?? [])
                    .filter((m: PaymentMethod) => m.type === "card")
                    .map((method: PaymentMethod, idx: number, arr: PaymentMethod[]) => (
                      <PaymentMethodItem
                        key={method.id}
                        method={method}
                        selectedMethod={selectedPaymentMethod ?? ({} as PaymentMethod)}
                        onSelect={(m) => {
                          setSelectedPaymentMethod(m);
                          setIsModalOpen(false);
                        }}
                        isLastItem={idx === arr.length - 1}
                      />
                    ))}
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ✅ Interest-free bottom sheet (web component) */}
      <InterestFreeSheet
        open={isIFOpen}
        onClose={() => setIsIFOpen(false)}
        availableIF={availableIF}
        originalAmount={totalAmountResolved}
        freeInput={freeInput}
        setFreeInput={setFreeInput}
        applyFree={applyFree}
      />

      <Toaster richColors position="top-right" />
    </>
  );
};

export default UnifiedPaymentPlan;
