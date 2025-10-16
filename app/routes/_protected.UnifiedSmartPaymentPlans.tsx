// File: src/routes/_protected.UnifiedSmartPaymentPlans.tsx

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "@remix-run/react";
import { toast, Toaster } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

// ── Smart Pay prerequisites (web analogs to RN) ──────────────────────────────
import { useCreditAccounts } from "~/hooks/useCreditAccounts";
import { useSmartpayPreferencesMe } from "~/hooks/useSmartpayPreferencesMe";
import { useSmartpayIncomes } from "~/hooks/useSmartpayIncomes";

// User & detailed plan (supplies BOTH plan + calendar like RN)
import { useUserDetails } from "~/hooks/useUserDetails";
import { useSmartpayDetailedPlan } from "~/hooks/useSmartpayDetailedPlan";

// STRICT per-user payment methods (updated signature)
import { usePaymentMethods, type PaymentMethod } from "~/hooks/usePaymentMethods";

// UI components (web)
import PaymentCircle from "~/compoments/PaymentCircle";
import CustomCalendar from "~/compoments/CustomCalendar";
import FlipCard from "~/compoments/FlipCard";
import FlippedContent from "~/compoments/FlippedContent";
import PaymentMethodItem from "~/compoments/PaymentMethodItem";
import SelectedPaymentMethod from "~/compoments/SelectedPaymentMethod";

// ✅ Unified commerce hook & helpers (parity with RN)
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
  type SendRecipient,
  type UnifiedCommerceRequest,
} from "~/hooks/useUnifiedCommerce";
import InterestFreeSheet from "~/compoments/InterestFreeSheet";


// ────────────────────────────────────────────────────────────────────────────

type Frequency = "BI_WEEKLY" | "MONTHLY";

interface SuperchargeDetailProp {
  amount: string; // dollars string
  paymentMethodId: string;
}
interface SplitEntryProp {
  userId: string;
  amount: string; // dollars string
}
interface UnifiedSmartPaymentPlansProps {
  amount?: string;
  instantPowerAmount?: string;
  yearlyPowerAmount?: string;
  superchargeDetails?: SuperchargeDetailProp[];
  otherUserAmounts?: SplitEntryProp[];
  selectedDiscounts?: string[];
  // Unified commerce passthrough (from URL)
  merchantId?: string;
  split?: "true" | "false" | "";
  recipient?: string; // JSON: { recipientId, amount }
  discountList?: string; // JSON array of ids/codes
  requestId?: string;
  transactionType?: string; // CHECKOUT|PAYMENT|SEND|ACCEPT_REQUEST|ACCEPT_SPLIT_REQUEST|VIRTUAL_CARD|SOTERIA_PAYMENT
  paymentPlanId?: string;
  paymentSchemeId?: string;
  splitPaymentId?: string;
}

interface PaymentDetail {
  dueDate: string;
  amount: number;
}
interface DateDetails {
  date: string;
  splitPayments: PaymentDetail[];
  incomeEvents: { date: string; amount: number; provider: string }[];
  liabilityEvents: { date: string; amount: number; type: string }[];
  rentEvents: { date: string; amount: number; type: string }[];
  paymentPlanPayments: PaymentDetail[];
  isAvoided: boolean;
  avoidedRangeName?: string;
  avoidedRangeId?: string;
}

// Allowed Unified types
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

const ACCENT = "#00BFFF";

const normalizeStr = (v: any, fallback = ""): string => {
  const val = Array.isArray(v) ? (v[0] ?? fallback) : (v ?? fallback);
  if (val === "null" || val === "undefined") return "";
  return typeof val === "string" ? val : fallback;
};

const parseNumber = (v: string | undefined, def = 0): number => {
  const n = parseFloat(v ?? "");
  return Number.isFinite(n) ? Number(n.toFixed(2)) : def;
};

const UnifiedSmartPaymentPlans: React.FC<UnifiedSmartPaymentPlansProps> = (props) => {
  const navigate = useNavigate();
  const { search } = useLocation();
  const qs = new URLSearchParams(search);

  // ── Resolve params (props override URL) ────────────────────────────────────
  const getParam = (key: keyof UnifiedSmartPaymentPlansProps, def = "") =>
    normalizeStr((props as any)[key] ?? qs.get(String(key)) ?? def, def);

  const amountStr = getParam("amount", "");
  const instantPowerAmount = getParam("instantPowerAmount", "");
  const yearlyPowerAmount = getParam("yearlyPowerAmount", "");
  const merchantId = getParam("merchantId", "");
  const discountListRaw = getParam("discountList", "[]");
  const requestId = getParam("requestId", "");
  const transactionTypeParam = getParam("transactionType", "");
  const recipientRaw = getParam("recipient", "");

  const paymentPlanId = getParam("paymentPlanId", "") || undefined;
  const paymentSchemeId = getParam("paymentSchemeId", "") || undefined;
  const splitPaymentId = getParam("splitPaymentId", "") || undefined;

  const propSupercharge = (props.superchargeDetails ?? []) as SuperchargeDetailProp[];
  const propDiscounts = (props.selectedDiscounts ?? []) as string[];

  // Use RN logic: if yearly provided, that's the one; else instant; else `amount` param
  const displayedAmount = useMemo(() => {
    const raw = yearlyPowerAmount || instantPowerAmount || amountStr || "0";
    return parseNumber(raw, 0);
  }, [yearlyPowerAmount, instantPowerAmount, amountStr]);

  // Frequency default: if yearly mode -> MONTHLY, else BI_WEEKLY
  const isYearlyMode = !!yearlyPowerAmount;
  const [frequency] = useState<Frequency>(isYearlyMode ? "MONTHLY" : "BI_WEEKLY");

  // Unified transaction type (strict)
  const transactionType: AllowedType | null = useMemo(() => {
    const t = transactionTypeParam.toUpperCase();
    return (ALLOWED_TYPES as readonly string[]).includes(t as AllowedType)
      ? (t as AllowedType)
      : null;
  }, [transactionTypeParam]);

  // Discounts (merge props + discountList QS)
  const parsedDiscountIds: string[] = useMemo(() => {
    let fromQS: string[] = [];
    try {
      const arr = JSON.parse(discountListRaw);
      if (Array.isArray(arr)) fromQS = arr.map(String).filter(Boolean);
    } catch {}
    const merged = Array.from(new Set([...(propDiscounts || []), ...fromQS]));
    return merged;
  }, [discountListRaw, propDiscounts]);
  const hasDiscounts = parsedDiscountIds.length > 0;

  // Single SEND recipient
  const recipientObj: SendRecipient | null = useMemo(() => {
    if (!recipientRaw) return null;
    try {
      const x = JSON.parse(recipientRaw);
      const rid = String(x?.recipientId || "");
      const amt = Number(x?.amount || 0);
      if (!rid || !Number.isFinite(amt) || amt <= 0) return null;
      return { recipientId: rid, amount: amt };
    } catch {
      return null;
    }
  }, [recipientRaw]);

  // Derived total supercharge
  const totalSupercharge = useMemo(
    () =>
      (propSupercharge || []).reduce((sum, s) => {
        const v = parseFloat(s.amount);
        return sum + (isNaN(v) ? 0 : Number(v.toFixed(2)));
      }, 0),
    [propSupercharge]
  );

  // Final purchase amount the plan is built on
  const purchaseAmount = displayedAmount;

  // ── User & Smart Pay prerequisites ────────────────────────────────────────
  const { data: userRes, isLoading: userLoading, isError: userError } = useUserDetails();
  const currentUserId: string | undefined = userRes?.data?.user?.id;
  const smartPayEnabledFlag = userRes?.data?.user.smartPay === true;
  const availableIF = Number(userRes?.data?.interestFreeCreditAmount ?? 0);

  const { data: creditRes, isLoading: creditLoading } = useCreditAccounts();
  const { data: preferences, isLoading: prefLoading } = useSmartpayPreferencesMe();
  const { data: incomes, isLoading: incomesLoading } = useSmartpayIncomes();

  const creditTokens = creditRes?.data?.tokens ?? [];
  const hasCredit = creditTokens.length > 0;
  const hasPreferences = preferences != null;
  const hasIncomes = Array.isArray(incomes) && incomes.length > 0;
  const smartEnabled = hasCredit && hasPreferences && hasIncomes;

  // Detailed Smart Plan (like RN uses) — this includes calendar + plan
  const { data: detailedData, isLoading: detailedLoading } = useSmartpayDetailedPlan(
    purchaseAmount,
    (isYearlyMode ? "MONTHLY" : "BI_WEEKLY"),
    !isYearlyMode, // instantaneous pricing when not yearly
    isYearlyMode, // yearly pricing when yearly
    0 // we’ll apply interestFreeUsed only in Unified common payload (UI controls below)
  );

  // Strict per-user payment methods
  const {
    data: methods = [],
    isLoading: methodsLoading,
    isError: methodsError,
  } = usePaymentMethods(currentUserId);

  // Unified Commerce mutation (web analog)
  const { mutateAsync: runUnified, isPending: unifiedPending } = useUnifiedCommerce();

  // ── Selection state ───────────────────────────────────────────────────────
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  // prefer primary card by default
  useEffect(() => {
    if (!methods.length || selectedPaymentMethod) return;
    const primary = methods.find((m) => m.type === "card" && m.card?.primary === true);
    const firstCard = methods.find((m) => m.type === "card");
    setSelectedPaymentMethod(primary ?? firstCard ?? methods[0]);
  }, [methods, selectedPaymentMethod]);

  const [rotation, setRotation] = useState(0);
  const handleToggle = useCallback(() => setRotation((r) => (r === 0 ? 180 : 0)), []);

  const [isMethodModalOpen, setIsMethodModalOpen] = useState(false);

  // Interest-free controls (chip + bottom sheet)
  const [interestFreeUsed, setInterestFreeUsed] = useState(0);
  const [freeInput, setFreeInput] = useState("");
  const [isIFModalOpen, setIsIFModalOpen] = useState(false);

  const [showFullExplanation, setShowFullExplanation] = useState(false);

  const [selectedDetails, setSelectedDetails] = useState<DateDetails | null>(null);

  // ── Loading / gates (mirror RN) ───────────────────────────────────────────
  if (userLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-white">
        <div className="loader h-16 w-16" />
        <p className="mt-4">Loading user…</p>
      </div>
    );
  }
  if (!userRes || userError) {
    return (
      <div className="flex items-center justify-center h-screen p-4 bg-white">
        <p className="text-red-500 text-center">Failed to load user details</p>
      </div>
    );
  }
  if (creditLoading || prefLoading || incomesLoading || detailedLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-white">
        <div className="loader h-16 w-16" />
        <p className="mt-4">Preparing Smart Plan…</p>
      </div>
    );
  }
  if (!smartEnabled || !smartPayEnabledFlag) {
    return (
      <div className="flex items-center justify-center h-screen p-4 bg-white">
        <p className="text-red-500 text-center">
          Smart Pay is unavailable. Please add income, preferences, and a credit institution — and enable Smart Pay in settings.
        </p>
      </div>
    );
  }

  // ── Unwrap Smart Plan like RN ─────────────────────────────────────────────
  const { plan, calendar, explanation } = detailedData ?? ({} as any);
  const {
    splitPayments = [],
    paymentCycles = [],
    incomeEvents = [],
    liabilityEvents = [],
    rentEvents = [],
    avoidedDates = [],
    planEvents = [],
  } = calendar ?? {};

  // Filter non-zero installments & detect due-today
  const mockPayments = (paymentCycles || []).filter((c: any) => (c?.amount ?? 0) > 0);
  const today = new Date().toISOString().split("T")[0];
  const hasDueToday = mockPayments.some((c: any) => c.dueDate === today);

  // ── Calendar selection handler (flip to details) ──────────────────────────
  const onDateSelect = (date: Date) => {
    const iso = date.toISOString().split("T")[0];

    setSelectedDetails({
      date: iso,
      splitPayments: (splitPayments || [])
        .filter((p: any) => p.date === iso)
        .map((p: any) => ({ dueDate: p.date, amount: p.amount })),
      incomeEvents: (incomeEvents || []).filter((e: any) => e.date === iso),
      liabilityEvents: (liabilityEvents || []).filter((l: any) => l.date === iso),
      rentEvents: (rentEvents || []).filter((r: any) => r.date === iso),
      paymentPlanPayments: (planEvents || [])
        .filter((evt: any) => evt.plannedPaymentDate === iso)
        .map((evt: any) => ({ dueDate: evt.plannedPaymentDate, amount: evt.allocatedPayment })),
      isAvoided: !!(avoidedDates || []).find((r: any) => {
        const s = new Date(r.startDate),
          e = new Date(r.endDate);
        return date >= s && date <= e;
      })!,
      avoidedRangeName: (avoidedDates || []).find((r: any) => {
        const s = new Date(r.startDate),
          e = new Date(r.endDate);
        return date >= s && date <= e;
      })?.name,
      avoidedRangeId: (avoidedDates || []).find((r: any) => {
        const s = new Date(r.startDate),
          e = new Date(r.endDate);
        return date >= s && date <= e;
      })?.id,
    });

    setRotation((r) => (r === 0 ? 180 : 0));
  };

  // ── Helpers: build Splits & Common block (RN parity) ──────────────────────
  const buildSplitsFromMock = useCallback((): SplitPaymentDetailDTO[] => {
    const count = Math.max(1, (mockPayments || []).length);
    const basePer = count ? purchaseAmount / count : 0;
    return (mockPayments || []).map((c: any) => ({
      dueDate: c.dueDate,
      amount: Number(c.amount ?? 0),
      originalAmount: Number(basePer || 0),
      interestFreeSlice: Number(c.interestFreeSlice ?? 0),
      interestRate: Number(plan?.periodInterestRate ?? 0),
      interestAmount: Number(c.interestAmount ?? 0),
      originalInterestAmount: Number(c.originalInterestAmount ?? 0),
    }));
  }, [mockPayments, purchaseAmount, plan?.periodInterestRate]);

  const allSplitUsers = useMemo(
    () =>
      (props.otherUserAmounts ?? [])
        .map((u) => ({
          userId: String(u.userId),
          amount: Number(parseFloat(u.amount) || 0),
        }))
        .filter((u) => !!u.userId && Number.isFinite(u.amount) && u.amount >= 0),
    [props.otherUserAmounts]
  );
  const isSplitFlow = allSplitUsers.length > 0;

  const buildCommonFields = useCallback(() => {
    const splits = buildSplitsFromMock();

    const mappedSupers = (props.superchargeDetails ?? []).map((s) => ({
      amount: Number(parseFloat(s.amount) || 0),
      paymentMethodId: s.paymentMethodId,
    }));

    const superSum = mappedSupers.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
    const schemeTotalAmount = Number((purchaseAmount + superSum).toFixed(2));

    // exclude current user from otherUsers
    let others: { userId: string; amount: number }[] | undefined = undefined;
    if (isSplitFlow && currentUserId) {
      others = allSplitUsers
        .filter((u) => u.userId !== currentUserId)
        .map((u) => ({ userId: u.userId, amount: Number(u.amount) || 0 }));
    }

    return {
      paymentFrequency: (isYearlyMode ? "MONTHLY" : frequency) as Frequency,
      numberOfPayments: splits.length || mockPayments.length || 1,
      offsetStartDate: mockPayments[0]?.dueDate || today,

      instantAmount: Number(isYearlyMode ? 0 : purchaseAmount.toFixed(2)),
      yearlyAmount: Number(isYearlyMode ? purchaseAmount.toFixed(2) : 0),

      selectedPaymentMethod: selectedPaymentMethod?.id,
      superchargeDetails: mappedSupers,
      splitSuperchargeDetails: [],

      selfPayActive: false,
      totalPlanAmount: Number(((plan?.totalAmount ?? purchaseAmount)).toFixed(2)),
      interestFreeUsed: Number(interestFreeUsed.toFixed(2)),
      interestRate: Number(plan?.periodInterestRate ?? 0),
      apr: Number(plan?.apr ?? 0),
      schemeTotalAmount,

      splitPaymentsList: splits,
      otherUsers: others,

      ...(hasDiscounts ? { discountIds: parsedDiscountIds } : {}),
    };
  }, [
    buildSplitsFromMock,
    props.superchargeDetails,
    purchaseAmount,
    isYearlyMode,
    frequency,
    mockPayments,
    selectedPaymentMethod?.id,
    plan?.totalAmount,
    interestFreeUsed,
    plan?.periodInterestRate,
    plan?.apr,
    isSplitFlow,
    allSplitUsers,
    currentUserId,
    hasDiscounts,
    parsedDiscountIds,
  ]);

  const buildVirtualCardOptions = useCallback((): VirtualCardOptions => {
    // Keep minimal; backend defaults apply
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
      // keep either soteriaPaymentTotalAmount or paymentTotalAmount + common
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
      console.log(`[UnifiedSmartPaymentPlans/web] Sending ${op} request:\n${json}`);
    } catch {
      // eslint-disable-next-line no-console
      console.log(`[UnifiedSmartPaymentPlans/web] Sending ${op} request (stringify failed).`, req);
    }
  }, []);

  // ── Confirm handler (RN parity) ───────────────────────────────────────────
  const handleConfirm = async () => {
    if (!transactionType) {
      toast.info("Missing transactionType param.");
      return;
    }

    // need a method for most flows (not required for SEND / SOTERIA / accept*)
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
          if (!merchantId) {
            toast.info("Missing merchantId for virtual card.");
            return;
          }
          const commonAny: any = buildCommonFields();
          const virtualCard = buildVirtualCardOptions();

          let req = buildVirtualCardRequestWithOptions(merchantId, virtualCard, commonAny);
          req = sanitizeForType("VIRTUAL_CARD", req);
          logUnifiedPayload("VIRTUAL_CARD", req);

          await runUnified(req);
          navigate("/card-details");
          break;
        }

        case "PAYMENT": {
          const common = buildCommonFields();
          let req = buildPaymentRequest(
            {
              merchantId,
              paymentTotalAmount: { amount: Number(purchaseAmount.toFixed(2)), currency: "USD" },
            },
            common
          );
          req = sanitizeForType("PAYMENT", req);
          logUnifiedPayload("PAYMENT", req);

          await runUnified(req);
          navigate(`/success?amount=${encodeURIComponent(purchaseAmount.toFixed(2))}&replace_to_index=1`);
          break;
        }

        case "CHECKOUT": {
          const common = buildCommonFields();
          let req = buildCheckoutRequest(
            {
              checkoutMerchantId: merchantId,
              checkoutTotalAmount: { amount: Number(purchaseAmount.toFixed(2)), currency: "USD" },
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
          navigate(`/success?amount=${encodeURIComponent(purchaseAmount.toFixed(2))}&replace_to_index=1`);
          break;
        }

        case "SEND": {
          if (!recipientObj) {
            toast.info("Provide a valid single recipient JSON.");
            return;
          }
          const common = buildCommonFields();
          let req = buildSendRequest(recipientObj, { senderId: "", note: "Transfer" }, common);
          req = sanitizeForType("SEND", req);
          logUnifiedPayload("SEND", req);

          await runUnified(req);
          navigate(`/success?amount=${encodeURIComponent((+recipientObj.amount).toFixed(2))}&replace_to_index=1`);
          break;
        }

        case "ACCEPT_REQUEST": {
          if (!requestId) {
            toast.info("Missing requestId for ACCEPT_REQUEST.");
            return;
          }
          const common = buildCommonFields();
          let req = buildAcceptRequest(requestId, common);
          req = sanitizeForType("ACCEPT_REQUEST", req);
          logUnifiedPayload("ACCEPT_REQUEST", req);

          await runUnified(req);
          navigate(`/success?amount=${encodeURIComponent(purchaseAmount.toFixed(2))}&replace_to_index=1`);
          break;
        }

        case "ACCEPT_SPLIT_REQUEST": {
          if (!requestId) {
            toast.info("Missing requestId for ACCEPT_SPLIT_REQUEST.");
            return;
          }
          const common = buildCommonFields();
          let req = buildAcceptSplitRequest(requestId, common);
          req = sanitizeForType("ACCEPT_SPLIT_REQUEST", req);
          logUnifiedPayload("ACCEPT_SPLIT_REQUEST", req);

          await runUnified(req);
          navigate(`/success?amount=${encodeURIComponent(purchaseAmount.toFixed(2))}&replace_to_index=1`);
          break;
        }

        case "SOTERIA_PAYMENT": {
          const common = buildCommonFields();
          const soteriaPayload = {
            ...(paymentPlanId ? { paymentPlanId } : {}),
            ...(paymentSchemeId ? { paymentSchemeId } : {}),
            ...(splitPaymentId ? { splitPaymentId } : {}),
          };

          let req = buildSoteriaPaymentRequest(
            {
              merchantId,
              soteriaPaymentTotalAmount: { amount: Number(purchaseAmount.toFixed(2)), currency: "USD" },
              paymentTotalAmount: { amount: Number(purchaseAmount.toFixed(2)), currency: "USD" }, // compat
              soteriaPayload,
              ...(paymentPlanId ? { paymentPlanId } : {}),
              ...(paymentSchemeId ? { paymentSchemeId } : {}),
              ...(splitPaymentId ? { splitPaymentId } : {}),
            },
            common
          );
          req = sanitizeForType("SOTERIA_PAYMENT", req);
          logUnifiedPayload("SOTERIA_PAYMENT", req);

          await runUnified(req);
          navigate(`/success?amount=${encodeURIComponent(purchaseAmount.toFixed(2))}&replace_to_index=1`);
          break;
        }
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error("Unified SmartPlans (web) error:", e?.message || e);
      toast.error("Operation failed. Try again.");
    }
  };

  // ---------- Build FULL request for Customize (ALL TYPES) ----------
  const buildRequestForCustomize = useCallback((): UnifiedCommerceRequest | null => {
    if (!transactionType) return null;

    // we can still allow customize without planData because SmartPay provides dates via calendar
    const firstSplitDueDate = (mockPayments?.[0]?.dueDate) ?? today;

    switch (transactionType) {
      case "VIRTUAL_CARD": {
        if (!merchantId) return null;
        const common: any = { ...buildCommonFields(), offsetStartDate: firstSplitDueDate };
        const virtualCard: VirtualCardOptions = buildVirtualCardOptions();
        let req = buildVirtualCardRequestWithOptions(merchantId, virtualCard, common);
        return sanitizeForType("VIRTUAL_CARD", req);
      }
      case "CHECKOUT": {
        const common: any = { ...buildCommonFields(), offsetStartDate: firstSplitDueDate };
        let req = buildCheckoutRequest(
          {
            checkoutMerchantId: merchantId,
            checkoutTotalAmount: { amount: Number(purchaseAmount.toFixed(2)), currency: "USD" },
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
        const common: any = { ...buildCommonFields(), offsetStartDate: firstSplitDueDate };
        let req = buildPaymentRequest(
          {
            merchantId,
            paymentTotalAmount: { amount: Number(purchaseAmount.toFixed(2)), currency: "USD" },
          },
          common
        );
        return sanitizeForType("PAYMENT", req);
      }
      case "SEND": {
        if (!recipientObj) return null;
        const common: any = { ...buildCommonFields(), offsetStartDate: firstSplitDueDate };
        let req = buildSendRequest(recipientObj, { senderId: "", note: "Transfer" }, common);
        return sanitizeForType("SEND", req);
      }
      case "ACCEPT_REQUEST": {
        if (!requestId) return null;
        const common: any = { ...buildCommonFields(), offsetStartDate: firstSplitDueDate };
        let req = buildAcceptRequest(requestId, common);
        return sanitizeForType("ACCEPT_REQUEST", req);
      }
      case "ACCEPT_SPLIT_REQUEST": {
        if (!requestId) return null;
        const common: any = { ...buildCommonFields(), offsetStartDate: firstSplitDueDate };
        let req = buildAcceptSplitRequest(requestId, common);
        return sanitizeForType("ACCEPT_SPLIT_REQUEST", req);
      }
      case "SOTERIA_PAYMENT": {
        const common: any = { ...buildCommonFields(), offsetStartDate: firstSplitDueDate };
        let req = buildSoteriaPaymentRequest(
          {
            merchantId,
            soteriaPaymentTotalAmount: { amount: Number(purchaseAmount.toFixed(2)), currency: "USD" },
            paymentTotalAmount: { amount: Number(purchaseAmount.toFixed(2)), currency: "USD" }, // compat
            ...(paymentPlanId ? { paymentPlanId } : {}),
            ...(paymentSchemeId ? { paymentSchemeId } : {}),
            ...(splitPaymentId ? { splitPaymentId } : {}),
            soteriaPayload: {
              ...(paymentPlanId ? { paymentPlanId } : {}),
              ...(paymentSchemeId ? { paymentSchemeId } : {}),
              ...(splitPaymentId ? { splitPaymentId } : {}),
            },
          },
          common
        );
        return sanitizeForType("SOTERIA_PAYMENT", req);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    transactionType,
    merchantId,
    purchaseAmount,
    buildCommonFields,
    buildVirtualCardOptions,
    mockPayments,
    recipientObj,
    requestId,
    paymentPlanId,
    paymentSchemeId,
    splitPaymentId,
  ]);

  // Customize → build payload (all types) and go to web customize route
  const handleCustomize = () => {
    if (!transactionType) {
      toast.info("Missing transactionType");
      return;
    }
    if (transactionType === "VIRTUAL_CARD" && !selectedPaymentMethod) {
      toast.info("Select payment method before customizing.");
      return;
    }
    if (transactionType === "SEND" && !recipientObj) {
      toast.info("Recipient required.");
      return;
    }
    if ((transactionType === "ACCEPT_REQUEST" || transactionType === "ACCEPT_SPLIT_REQUEST") && !requestId) {
      toast.info("Missing requestId.");
      return;
    }

    const req = buildRequestForCustomize();
    if (!req) {
      toast.error("Could not build customize request");
      return;
    }
    sessionStorage.setItem("unified_customize_payload", JSON.stringify(req));
    navigate("/unified/customize");
  };

  // Stats
  const periodRate = Number(plan?.periodInterestRate ?? 0);
  const apr = Number(plan?.apr ?? 0);
  const totalAmount = Number(plan?.totalAmount ?? purchaseAmount);

  // Interest-free helpers (sheet)
  const digitsOnly = (s: string) => s.replace(/\D+/g, "");
  const handleIFChange = (v: string) => setFreeInput(digitsOnly(v));
  const freeAmountNum = Number(freeInput || "0");
  const applyFree = () => {
    const capped = Math.min(freeAmountNum || 0, availableIF, totalAmount);
    setInterestFreeUsed(capped);
    setIsIFModalOpen(false);
  };

  return (
    <>
      <div className="min-h-screen bg-white overflow-y-auto p-4">
        {/* Summary + interest-free chip */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Summary</h1>
          <button
            onClick={() => setIsIFModalOpen(true)}
            className="bg-[#E6F7FF] text-[#007AFF] font-bold rounded-xl px-3 py-1.5"
          >
            ⚡ ${interestFreeUsed.toFixed(2)}
          </button>
        </div>

        {/* Stats strip */}
        <div className="overflow-x-auto whitespace-nowrap py-3 -mx-1 mb-2">
          <div className="inline-flex px-1 space-x-3">
            {[
              { label: "Payments", value: String(mockPayments.length) },
              { label: "Purchase", value: `$${purchaseAmount.toFixed(2)}` },
              { label: "Interest/p", value: `${(periodRate * 100).toFixed(2)}%` },
              { label: "APR", value: `${(apr * 100).toFixed(2)}%` },
              { label: "Total", value: `$${totalAmount.toFixed(2)}` },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-white rounded-lg border border-gray-200 shadow-sm px-4 py-3 w-[140px] inline-flex flex-col items-center"
              >
                <span className="text-sm text-gray-600">{s.label}</span>
                <span className="text-base font-bold mt-1">{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Payment circles */}
        <div className="flex space-x-4 overflow-x-auto mb-6 scrollbar-hide">
          {mockPayments.map((item: any) => {
            const d = new Date(item.dueDate);
            return (
              <PaymentCircle
                key={item.dueDate}
                day={d.getDate()}
                month={d.toLocaleString("default", { month: "long" })}
                percentage={item.percentage}
                amount={Number(item.amount).toFixed(2)}
              />
            );
          })}
        </div>

        {/* Explanation with Show More / Show Less */}
        {String(explanation || "").trim().length > 0 && (
          <div className="max-w-3xl mx-auto mb-4 p-3 bg-white border border-gray-200 rounded-lg">
            <p className="font-semibold mb-1">How we calculated this:</p>
            <p className={`text-sm text-gray-700 ${showFullExplanation ? "" : "line-clamp-3"}`}>
              {explanation}
            </p>
            <button
              onClick={() => setShowFullExplanation((p) => !p)}
              className="mt-1 text-sm font-bold hover:underline"
            >
              {showFullExplanation ? "Show Less" : "Show More"}
            </button>
          </div>
        )}

        {/* FlipCard: calendar front / details back */}
        <div className="w-full max-w-2xl mx-auto mb-6 border border-gray-300 rounded" style={{ height: "85vh" }}>
          <FlipCard
            rotation={rotation}
            frontContent={
              <CustomCalendar
                initialDate={new Date()}
                /* source everything from useSmartpayDetailedPlan */
                splitPayments={splitPayments}
                incomeEvents={incomeEvents}
                liabilityEvents={liabilityEvents}
                rentEvents={rentEvents}
                avoidedDates={avoidedDates}
                planEvents={planEvents}
                renderSplitPayment={false}
                readonly
                onDateSelect={onDateSelect}
              />
            }
            backContent={
              <div className="h-full overflow-auto p-4">
                <FlippedContent details={selectedDetails} onToggle={() => setRotation((r) => (r === 0 ? 180 : 0))} readonly />
              </div>
            }
          />
        </div>

        {/* Payment method selector */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-3">Payment method</h2>
          {methodsLoading ? (
            <div className="flex justify-center">
              <div className="loader h-16 w-16" />
            </div>
          ) : methodsError ? (
            <p className="text-red-500">Error fetching methods</p>
          ) : (
            <SelectedPaymentMethod selectedMethod={selectedPaymentMethod} onPress={() => setIsMethodModalOpen(true)} />
          )}
        </div>

        {/* Buttons (Customize + Confirm) */}
        <div className="flex flex-col sm:flex-row gap-3">
          {hasDueToday && (
            <button
              onClick={handleCustomize}
              className="flex-1 border border-gray-300 rounded-lg py-3 font-bold bg-white"
            >
              Customize
            </button>
          )}

          <button
            onClick={handleConfirm}
            disabled={
              unifiedPending ||
              (!selectedPaymentMethod &&
                transactionType !== "ACCEPT_REQUEST" &&
                transactionType !== "ACCEPT_SPLIT_REQUEST" &&
                transactionType !== "SEND" &&
                transactionType !== "SOTERIA_PAYMENT")
            }
            className={`flex-1 rounded-lg py-3 font-bold text-white ${
              unifiedPending ? "bg-gray-500" : "bg-black hover:bg-gray-800"
            }`}
          >
            {transactionType === "VIRTUAL_CARD" ? "Pay & Issue Card" : "Pay & Finish"}
          </button>
        </div>
      </div>

      {/* Payment method picker modal (bottom-sheet vibe) */}
      <AnimatePresence>
        {isMethodModalOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black bg-opacity-50 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMethodModalOpen(false)}
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
                  <button onClick={() => navigate("/payment-settings")} className="bg-black text-white px-3 py-1 rounded">
                    Settings
                  </button>
                </div>

                <div className="p-4 space-y-4">
                  {methods
                    .filter((m) => m.type === "card")
                    .map((method, idx, arr) => (
                      <PaymentMethodItem
                        key={method.id}
                        method={method}
                        selectedMethod={selectedPaymentMethod ?? ({} as PaymentMethod)}
                        onSelect={(m) => {
                          setSelectedPaymentMethod(m);
                          setIsMethodModalOpen(false);
                        }}
                        isLastItem={idx === arr.length - 1}
                        GREEN_COLOR={ACCENT}
                      />
                    ))}
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ✅ Interest-free bottom sheet (web) */}
      <InterestFreeSheet
        open={isIFModalOpen}
        onClose={() => setIsIFModalOpen(false)}
        availableIF={availableIF}
        originalAmount={totalAmount}
        freeInput={freeInput}
        setFreeInput={handleIFChange}
        applyFree={applyFree}
      />

      <Toaster richColors position="top-right" />
    </>
  );
};

export default UnifiedSmartPaymentPlans;
