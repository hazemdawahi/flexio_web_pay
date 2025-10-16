// File: app/routes/UnifiedYearlyPaymentPlan.tsx

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useNavigate, useLocation } from "@remix-run/react";
import { toast, Toaster } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

import { useUserDetails } from "~/hooks/useUserDetails";
import { usePaymentMethods, type PaymentMethod } from "~/hooks/usePaymentMethods";
import { usePaymentPlanTerms, type CalculateTermsResponse } from "~/routes/usePaymentPlanTerms";
import {
  useCalculatePaymentPlan,
  type SplitPayment as CalcSplitPayment,
} from "~/hooks/useCalculatePaymentPlan";

// ✅ Unified commerce hook & builders (parity with UnifiedYearlyPaymentPlan RN screen)
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
  type UnifiedCommerceRequest,
  type SplitPaymentDetail,
  type SendRecipient,
} from "~/hooks/useUnifiedCommerce";

import PaymentMethodItem from "~/compoments/PaymentMethodItem";
import PaymentPlanMocking from "~/compoments/PaymentPlanMocking";
import SelectedPaymentMethod from "~/compoments/SelectedPaymentMethod";
import InterestFreeSheet from "~/compoments/InterestFreeSheet";

/* ───────────── Utilities ───────────── */
const ACCENT = "#00BFFF";

const normalizeParam = (v: string | string[] | null | undefined, fallback = ""): string => {
  const val = Array.isArray(v) ? (v[0] ?? fallback) : (v ?? fallback);
  if (val === "null" || val === "undefined") return "";
  return typeof val === "string" ? val : fallback;
};

const extractDiscountIds = (raw: string): string[] => {
  if (!raw || !raw.trim()) return [];
  const take = (x: any): string => {
    if (x == null) return "";
    if (typeof x === "string" || typeof x === "number") return String(x).trim();
    if (typeof x === "object") {
      const v = x.id ?? x.discountId ?? x.code ?? "";
      return typeof v === "string" || typeof v === "number" ? String(v).trim() : "";
    }
    return "";
  };
  const uniq = (a: string[]) => Array.from(new Set(a.filter(Boolean)));
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return uniq(parsed.map(take));
    if (typeof parsed === "string") return uniq(parsed.split(",").map((s) => s.trim()));
  } catch {
    return uniq(raw.split(",").map((s) => s.trim()));
  }
  return [];
};

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/* ───────────── Types ───────────── */
interface YearlyPaymentPlanProps {
  merchantId?: string;
  amount?: string; // yearly amount in dollars
  powerMode?: string; // kept for parity, we force YEARLY semantics

  superchargeDetails?: string; // JSON array
  otherUsers?: string;         // JSON array [{ userId, amount }]
  recipient?: string;          // JSON object { recipientId, amount }
  discountList?: string;       // JSON array ["disc_1","disc_2"]
  requestId?: string;
  transactionType?: string;    // CHECKOUT | PAYMENT | SEND | ACCEPT_REQUEST | ACCEPT_SPLIT_REQUEST | VIRTUAL_CARD | SOTERIA_PAYMENT

  // Optional extras (forwarded)
  totalAmount?: string;
  orderAmount?: string;
  displayLogo?: string;
  displayName?: string;
  split?: "true" | "false" | "";
  logoUri?: string;

  /** Soteria identifiers */
  paymentPlanId?: string;
  paymentSchemeId?: string;
  splitPaymentId?: string;
}

type AllowedType =
  | "CHECKOUT"
  | "PAYMENT"
  | "SEND"
  | "ACCEPT_REQUEST"
  | "ACCEPT_SPLIT_REQUEST"
  | "VIRTUAL_CARD"
  | "SOTERIA_PAYMENT";

const ALLOWED_TYPES: AllowedType[] = [
  "CHECKOUT",
  "PAYMENT",
  "SEND",
  "ACCEPT_REQUEST",
  "ACCEPT_SPLIT_REQUEST",
  "VIRTUAL_CARD",
  "SOTERIA_PAYMENT",
];

/* =============================================================== */

const UnifiedYearlyPaymentPlan: React.FC<Partial<YearlyPaymentPlanProps>> = (props) => {
  const navigate = useNavigate();
  const { search } = useLocation();
  const qs = new URLSearchParams(search);

  // Params (props precedence; parity with mobile)
  const getParam = (key: keyof YearlyPaymentPlanProps, def = "") =>
    normalizeParam((props as any)[key] ?? qs.get(String(key)), def);
  const getParamOptional = (key: keyof YearlyPaymentPlanProps) => {
    const s = getParam(key, "");
    return s === "" ? undefined : s;
  };

  const merchantId    = getParam("merchantId", "");
  const amount        = parseFloat(getParam("amount", "0")) || 0;
  const requestId     = getParam("requestId", "");
  const otherUsersRaw = getParam("otherUsers", "");
  const recipientRaw  = getParam("recipient", "");
  const discountsRaw  = getParam("discountList", "[]");
  const supersRaw     = getParam("superchargeDetails", "[]");

  // Optional passthrough/branding
  const displayName   = getParam("displayName", "");
  const logoUriParam  = getParam("logoUri", "");
  // Soteria identifiers
  const paymentPlanId   = getParamOptional("paymentPlanId");
  const paymentSchemeId = getParamOptional("paymentSchemeId");
  const splitPaymentId  = getParamOptional("splitPaymentId");

  const transactionTypeParam = getParamOptional("transactionType");
  const transactionType: AllowedType | null = useMemo(() => {
    const t = (transactionTypeParam || "").toUpperCase();
    return (ALLOWED_TYPES as readonly string[]).includes(t as AllowedType)
      ? (t as AllowedType)
      : null;
  }, [transactionTypeParam]);

  // Current user + methods (STRICT per-user cache)
  const { data: userDetails } = useUserDetails();
  const currentUserId: string | undefined = userDetails?.data?.user?.id;
  const availableIF = Number(userDetails?.data?.interestFreeCreditAmount ?? 0);

  // Payment methods
  const {
    data: methods = [],
    isLoading: methodsLoading,
    isError: methodsError,
  } = usePaymentMethods(currentUserId);

  // Discounts (shared)
  const parsedDiscountIds = useMemo(() => extractDiscountIds(discountsRaw), [discountsRaw]);
  const hasDiscounts = parsedDiscountIds.length > 0;

  // Supercharges
  const superchargeList = useMemo<{ amount: number; paymentMethodId: string }[]>(() => {
    try {
      const arr = JSON.parse(supersRaw) ?? [];
      return Array.isArray(arr)
        ? arr.map((s: any) => ({
            amount: Number(s?.amount ?? 0),
            paymentMethodId: String(s?.paymentMethodId ?? ""),
          }))
        : [];
    } catch {
      return [];
    }
  }, [supersRaw]);

  // Split (non-SEND)
  const allSplitUsers: { userId: string; amount: number }[] = useMemo(() => {
    if (!otherUsersRaw) return [];
    try {
      const maybe = /%7B|%5B|%22|%2C|%3A/.test(otherUsersRaw) ? decodeURIComponent(otherUsersRaw) : otherUsersRaw;
      const arr = JSON.parse(maybe);
      return Array.isArray(arr)
        ? arr
            .map((u: any) => ({ userId: String(u?.userId ?? ""), amount: Number(u?.amount ?? 0) }))
            .filter((u: any) => !!u.userId && Number.isFinite(u.amount) && u.amount >= 0)
        : [];
    } catch {
      return [];
    }
  }, [otherUsersRaw]);

  const splitUsersExcludingSelf = useMemo(() => {
    if (!currentUserId) return allSplitUsers;
    return allSplitUsers.filter((u) => u.userId !== currentUserId);
  }, [allSplitUsers, currentUserId]);

  const isSplitFlow = splitUsersExcludingSelf.length > 0;

  // SEND recipient
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

  // Terms + Plan (YEARLY semantics: frequency MONTHLY, yearly=true)
  const { mutate: fetchTerms, data: termsRes } = usePaymentPlanTerms();
  const { mutate: calculatePlan, data: planRes } = useCalculatePaymentPlan();
  const planData = planRes?.data ?? null;

  // Unified commerce mutation
  const { mutateAsync: runUnified, isPending: unifiedPending } = useUnifiedCommerce();

  // UI state
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);

  // Slider state (months) — split into live value vs committed selection
  const [serverMin, setServerMin] = useState<number | null>(null);
  const [serverMax, setServerMax] = useState<number | null>(null);
  const [sliderValue, setSliderValue] = useState(12);       // live thumb position (visual)
  const [selectedMonths, setSelectedMonths] = useState(12); // committed (plan recompute)

  // Interest-free state
  const [interestFreeUsed, setInterestFreeUsed] = useState(0);
  const [freeInput, setFreeInput] = useState("");
  const [isIFOpen, setIsIFOpen] = useState(false); // ← web bottom sheet open flag

  const [planBusy, setPlanBusy] = useState(true);
  const [planExplicitlyEmpty, setPlanExplicitlyEmpty] = useState(false);

  // Methods modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  // Default payment method (prefer primary)
  useEffect(() => {
    const cards: PaymentMethod[] = (methods ?? []).filter((m: PaymentMethod) => m.type === "card");
    if (!cards.length || selectedMethod) return;
    const primary = cards.find((m) => m.card?.primary === true);
    setSelectedMethod(primary ?? cards[0]);
  }, [methods, selectedMethod]);

  // Fetch terms initially
  useEffect(() => {
    if (amount <= 0) return;
    setPlanBusy(true);
    fetchTerms(
      { frequency: "MONTHLY", purchaseAmount: amount, instantaneous: false, yearly: true },
      {
        onSuccess: (res: CalculateTermsResponse) => {
          if (!res.success || res.data.minTerm == null) {
            toast.error("Could not fetch terms.");
            setPlanBusy(false);
          }
        },
        onError: () => {
          toast.error("Could not fetch terms.");
          setPlanBusy(false);
        },
      }
    );
  }, [amount, fetchTerms]);

  // Apply terms → update slider bounds and compute plan
  const lastRangeRef = useRef<{ min: number; max: number } | null>(null);
  useEffect(() => {
    if (!termsRes?.success) return;

    const min = Math.max(termsRes.data.minTerm ?? 1, 1);
    const max = termsRes.data.maxTerm ?? min;

    const last = lastRangeRef.current;
    const changed = !last || last.min !== min || last.max !== max;

    if (!changed) {
      if (!planData) triggerRecompute(selectedMonths);
      return;
    }

    lastRangeRef.current = { min, max };
    setServerMin(min);
    setServerMax(max);

    setSliderValue((v) => clamp(v, min, max));
    setSelectedMonths((m) => clamp(m, min, max));

    triggerRecompute(clamp(selectedMonths, min, max));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termsRes?.data?.minTerm, termsRes?.data?.maxTerm, termsRes?.success]);

  const triggerRecompute = useCallback(
    (months: number) => {
      if (!termsRes?.success) return;
      setPlanBusy(true);
      setPlanExplicitlyEmpty(false);

      calculatePlan(
        {
          frequency: "MONTHLY",
          numberOfPayments: months,
          purchaseAmount: amount,
          startDate,
          selfPay: false,
          instantaneous: false,
          yearly: true,
          interestFreeAmt: interestFreeUsed,
        },
        {
          onSuccess: (res) => {
            const empty =
              !!res?.success &&
              (!res.data || !Array.isArray(res.data.splitPayments) || res.data.splitPayments.length === 0);
            setPlanExplicitlyEmpty(empty);
            setPlanBusy(false);
          },
          onError: () => {
            setPlanExplicitlyEmpty(false);
            setPlanBusy(false);
            toast.error("Could not calculate plan.");
          },
        }
      );
    },
    [termsRes?.success, calculatePlan, amount, startDate, interestFreeUsed]
  );

  useEffect(() => {
    if (!termsRes?.success) return;
    triggerRecompute(selectedMonths);
  }, [selectedMonths, startDate, interestFreeUsed, amount, termsRes?.success, triggerRecompute]);

  const hasPlanData = !!(planData?.splitPayments?.length);
  const showNoPlan = !planBusy && planExplicitlyEmpty;

  const today = new Date().toISOString().split("T")[0];
  const mockPayments: CalcSplitPayment[] =
    (planData?.splitPayments ?? []).map((p) => ({
      dueDate: p.dueDate,
      amount: p.amount,
      originalAmount: p.originalAmount,
      interestFreeSlice: p.interestFreeSlice,
      interestRate: p.interestRate,
      interestAmount: p.interestAmount,
      originalInterestAmount: p.originalInterestAmount,
    })) ?? [];
  const hasDueToday = mockPayments.some((p) => p.dueDate === today);

  // Helpers: splits + common (with discountIds)
  const buildSplits = useCallback(
    (plan: typeof planData): SplitPaymentDetail[] => {
      if (!plan?.splitPayments) return [];
      return plan.splitPayments.map((p) => ({
        dueDate: p.dueDate,
        amount: Number(p.amount ?? 0),
        originalAmount: Number(p.originalAmount ?? 0),
        interestFreeSlice: Number(p.interestFreeSlice ?? 0),
        interestRate: Number(p.interestRate ?? 0),
        interestAmount: Number(p.interestAmount ?? 0),
        originalInterestAmount: Number(p.originalInterestAmount ?? 0),
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
    splitPaymentsList?: SplitPaymentDetail[];
    otherUsers?: { userId: string; amount: number }[];
    discountIds?: string[];
  };

  const firstDueDate = planData?.splitPayments?.[0]?.dueDate ?? startDate;

  const buildCommonFields = useCallback(
    (plan: typeof planData): CommonWithDiscounts => {
      const splits = buildSplits(plan);

      const mappedSupercharges = (superchargeList || []).map((s) => ({
        amount: Number(s.amount),
        paymentMethodId: s.paymentMethodId,
      }));

      const superSum = (superchargeList || []).reduce((acc, s) => {
        const n = Number(s.amount);
        return acc + (isNaN(n) ? 0 : n);
      }, 0);
      const schemeTotalAmount = Number((amount + superSum).toFixed(2));

      const others =
        isSplitFlow
          ? splitUsersExcludingSelf.map((u) => ({ userId: u.userId, amount: Number(u.amount) || 0 }))
          : undefined;

      return {
        paymentFrequency: "MONTHLY",
        numberOfPayments: splits.length || Number(selectedMonths) || 1,
        offsetStartDate: firstDueDate,
        instantAmount: 0,
        yearlyAmount: Number(amount.toFixed(2)),
        selectedPaymentMethod: selectedMethod?.id,
        superchargeDetails: mappedSupercharges,
        splitSuperchargeDetails: [],
        selfPayActive: false,
        totalPlanAmount: Number(((plan?.totalAmount ?? amount)).toFixed(2)),
        interestFreeUsed: Number(interestFreeUsed.toFixed(2)),
        interestRate: Number(plan?.periodInterestRate ?? 0),
        apr: Number(plan?.apr ?? 0),
        schemeTotalAmount,
        splitPaymentsList: splits,
        otherUsers: others,
        ...(hasDiscounts ? { discountIds: parsedDiscountIds } : {}),
      };
    },
    [
      buildSplits,
      superchargeList,
      amount,
      isSplitFlow,
      splitUsersExcludingSelf,
      selectedMonths,
      firstDueDate,
      selectedMethod?.id,
      interestFreeUsed,
      hasDiscounts,
      parsedDiscountIds,
    ]
  );

  const buildVirtualCardOptions = useCallback((): VirtualCardOptions => {
    // Leave defaults; provide only overrides if desired
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
      // keep soteriaPaymentTotalAmount/paymentTotalAmount (compat) and common fields
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
      console.log(`[UnifiedYearlyPaymentPlan/web] Sending ${op} request:\n${json}`);
    } catch {
      // eslint-disable-next-line no-console
      console.log(`[UnifiedYearlyPaymentPlan/web] Sending ${op} request (stringify failed).`, req);
    }
  }, []);

  // Build FULL request for Customize (all types)
  const buildRequestForCustomize = useCallback((): UnifiedCommerceRequest | null => {
    if (!transactionType) return null;
    if (!planData && transactionType !== "SEND" && transactionType !== "SOTERIA_PAYMENT") return null;

    const firstSplitDueDate = planData?.splitPayments?.[0]?.dueDate ?? startDate;

    switch (transactionType) {
      case "VIRTUAL_CARD": {
        const common: any = { ...buildCommonFields(planData), offsetStartDate: firstSplitDueDate };
        const virtualCard: VirtualCardOptions = buildVirtualCardOptions();
        let req = buildVirtualCardRequestWithOptions(merchantId, virtualCard, common);
        return sanitizeForType("VIRTUAL_CARD", req);
      }
      case "CHECKOUT": {
        const common: any = { ...buildCommonFields(planData), offsetStartDate: firstSplitDueDate };
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
        const common: any = { ...buildCommonFields(planData), offsetStartDate: firstSplitDueDate };
        let req = buildPaymentRequest(
          {
            merchantId,
            paymentTotalAmount: { amount: Number(amount.toFixed(2)), currency: "USD" },
          },
          common
        );
        return sanitizeForType("PAYMENT", req);
      }
      case "SEND": {
        if (!recipientObj) return null;
        const common: any = { ...buildCommonFields(planData), offsetStartDate: firstSplitDueDate };
        let req = buildSendRequest(recipientObj, { senderId: "", note: "Transfer" }, common);
        return sanitizeForType("SEND", req);
      }
      case "ACCEPT_REQUEST": {
        if (!requestId) return null;
        const common: any = { ...buildCommonFields(planData), offsetStartDate: firstSplitDueDate };
        let req = buildAcceptRequest(requestId, common);
        return sanitizeForType("ACCEPT_REQUEST", req);
      }
      case "ACCEPT_SPLIT_REQUEST": {
        if (!requestId) return null;
        const common: any = { ...buildCommonFields(planData), offsetStartDate: firstSplitDueDate };
        let req = buildAcceptSplitRequest(requestId, common);
        return sanitizeForType("ACCEPT_SPLIT_REQUEST", req);
      }
      case "SOTERIA_PAYMENT": {
        if (!paymentPlanId || !splitPaymentId) return null;
        const common: any = { ...buildCommonFields(planData), offsetStartDate: firstSplitDueDate };
        const soteriaPayload = {
          ...(paymentPlanId   ? { paymentPlanId }   : {}),
          ...(paymentSchemeId ? { paymentSchemeId } : {}),
          ...(splitPaymentId  ? { splitPaymentId }  : {}),
        };
        let req = buildSoteriaPaymentRequest(
          {
            merchantId,
            soteriaPaymentTotalAmount: { amount: Number(amount.toFixed(2)), currency: "USD" },
            paymentTotalAmount: { amount: Number(amount.toFixed(2)), currency: "USD" }, // compat
            ...(paymentPlanId   ? { paymentPlanId }   : {}),
            ...(paymentSchemeId ? { paymentSchemeId } : {}),
            ...(splitPaymentId  ? { splitPaymentId }  : {}),
            soteriaPayload,
          },
          common
        );
        return sanitizeForType("SOTERIA_PAYMENT", req);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    transactionType,
    planData,
    buildCommonFields,
    buildVirtualCardOptions,
    merchantId,
    amount,
    requestId,
    recipientObj,
    startDate,
    paymentPlanId,
    paymentSchemeId,
    splitPaymentId,
  ]);

  // Confirm handler (same switch as RN)
  const handleFinish = async () => {
    if (!transactionType) {
      toast.info("Missing transactionType param.");
      return;
    }
    if (!hasPlanData && transactionType !== "SEND" && transactionType !== "SOTERIA_PAYMENT") {
      toast.info("Missing plan. Wait for calculation.");
      return;
    }
    if (
      !selectedMethod &&
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
            toast.info("Missing merchantId for VIRTUAL_CARD.");
            return;
          }
          const common: any = buildCommonFields(planData);
          const virtualCard: VirtualCardOptions = buildVirtualCardOptions();
          let req = buildVirtualCardRequestWithOptions(merchantId, virtualCard, common);
          req = sanitizeForType("VIRTUAL_CARD", req);
          logUnifiedPayload("VIRTUAL_CARD", req);
          await runUnified(req);
          navigate("/card-details");
          break;
        }

        case "PAYMENT": {
          const common: any = buildCommonFields(planData);
          let req = buildPaymentRequest(
            {
              merchantId,
              paymentTotalAmount: { amount: Number(amount.toFixed(2)), currency: "USD" },
            },
            common
          );
          req = sanitizeForType("PAYMENT", req);
          logUnifiedPayload("PAYMENT", req);
          await runUnified(req);
          navigate(`/success?amount=${encodeURIComponent(Number(amount).toFixed(2))}&replace_to_index=1`);
          break;
        }

        case "CHECKOUT": {
          const common: any = buildCommonFields(planData);
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
            common as any
          );
          req = sanitizeForType("CHECKOUT", req);
          logUnifiedPayload("CHECKOUT", req);
          await runUnified(req);
          navigate(`/success?amount=${encodeURIComponent(Number(amount).toFixed(2))}&replace_to_index=1`);
          break;
        }

        case "SEND": {
          if (!recipientObj) {
            toast.info("Provide a valid single recipient JSON.");
            return;
          }
          const common: any = buildCommonFields(planData);
          let req = buildSendRequest(recipientObj, { senderId: "", note: "Transfer" }, common);
          req = sanitizeForType("SEND", req);
          logUnifiedPayload("SEND", req);
          await runUnified(req);
          const amtStr = Number((recipientObj as any).amount).toFixed(2);
          navigate(`/success?amount=${encodeURIComponent(amtStr)}&replace_to_index=1`);
          break;
        }

        case "ACCEPT_REQUEST": {
          if (!requestId) {
            toast.info("Missing requestId for ACCEPT_REQUEST.");
            return;
          }
          const common: any = buildCommonFields(planData);
          let req = buildAcceptRequest(requestId, common);
          req = sanitizeForType("ACCEPT_REQUEST", req);
          logUnifiedPayload("ACCEPT_REQUEST", req);
          await runUnified(req);
          navigate(`/success?amount=${encodeURIComponent(Number(amount).toFixed(2))}&replace_to_index=1`);
          break;
        }

        case "ACCEPT_SPLIT_REQUEST": {
          if (!requestId) {
            toast.info("Missing requestId for ACCEPT_SPLIT_REQUEST.");
            return;
          }
          const common: any = buildCommonFields(planData);
          let req = buildAcceptSplitRequest(requestId, common);
          req = sanitizeForType("ACCEPT_SPLIT_REQUEST", req);
          logUnifiedPayload("ACCEPT_SPLIT_REQUEST", req);
          await runUnified(req);
          navigate(`/success?amount=${encodeURIComponent(Number(amount).toFixed(2))}&replace_to_index=1`);
          break;
        }

        case "SOTERIA_PAYMENT": {
          if (!paymentPlanId || !splitPaymentId) {
            toast.error(!paymentPlanId ? "paymentPlanId is required." : "splitPaymentId is required.");
            return;
          }
          const common: any = buildCommonFields(planData);
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
              ...(paymentPlanId   ? { paymentPlanId }   : {}),
              ...(paymentSchemeId ? { paymentSchemeId } : {}),
              ...(splitPaymentId  ? { splitPaymentId }  : {}),
              soteriaPayload,
            },
            common
          );
          req = sanitizeForType("SOTERIA_PAYMENT", req);
          logUnifiedPayload("SOTERIA_PAYMENT", req);
          await runUnified(req);
          navigate(`/success?amount=${encodeURIComponent(Number(amount).toFixed(2))}&replace_to_index=1`);
          break;
        }
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error("Unified yearly error:", e?.message || e);
      toast.error("Operation failed. Try again.");
    }
  };

  // Customize button (only when first due is today & request type allows)
  const canCustomize =
    !!planData &&
    (planData?.splitPayments?.some((p) => p?.dueDate === today) ?? false) &&
    !!transactionType &&
    (
      (transactionType === "VIRTUAL_CARD" && !!selectedMethod) ||
      (transactionType === "SEND" && !!recipientObj) ||
      (transactionType === "ACCEPT_REQUEST" && !!requestId) ||
      (transactionType === "ACCEPT_SPLIT_REQUEST" && !!requestId) ||
      transactionType === "CHECKOUT" ||
      transactionType === "PAYMENT" ||
      transactionType === "SOTERIA_PAYMENT"
    );

  // Interest-free helpers for sheet
  const totalAmountResolved = Number(planData?.totalAmount ?? amount);
  const freeAmountNum = Number(freeInput || "0");
  const applyFree = () => {
    const capped = Math.min(freeAmountNum || 0, availableIF, totalAmountResolved);
    setInterestFreeUsed(capped);
    setIsIFOpen(false);
  };

  // 🔧 Slider fill should follow the live thumb (sliderValue), not the committed value.
  const fillPercent =
    serverMin != null && serverMax != null && serverMax > serverMin
      ? ((sliderValue - serverMin) / (serverMax - serverMin)) * 100
      : 0;

  return (
    <>
      <style>
        {`
        :root {
          --accent: ${ACCENT};
          --track-height: 10px;
          --thumb-size: 18px;
          /* Center the thumb relative to the track:
             offset = (track-height - thumb-size) / 2  */
          --thumb-offset: calc((var(--track-height) - var(--thumb-size)) / 2);
        }
        /* Base */
        input[type="range"] {
          -webkit-appearance: none;
          width: 100%;
          height: var(--track-height);
          border-radius: 6px;
          background: #eee;
          outline: none;
          cursor: pointer;
        }
        /* WebKit track */
        input[type="range"]::-webkit-slider-runnable-track {
          height: var(--track-height);
          border-radius: 6px;
          background: transparent;
        }
        /* WebKit thumb */
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: var(--thumb-size);
          height: var(--thumb-size);
          border-radius: 50%;
          background: var(--accent);
          border: 2px solid #fff;
          box-shadow: 0 0 0 1px #ccc;
          margin-top: var(--thumb-offset); /* properly center the thumb */
        }
        /* Firefox track */
        input[type="range"]::-moz-range-track {
          height: var(--track-height);
          border-radius: 6px;
          background: transparent;
        }
        /* Firefox fill (left of thumb) */
        input[type="range"]::-moz-range-progress {
          height: var(--track-height);
          border-radius: 6px 0 0 6px;
          background: var(--accent);
        }
        /* Firefox thumb */
        input[type="range"]::-moz-range-thumb {
          width: var(--thumb-size);
          height: var(--thumb-size);
          border-radius: 50%;
          background: var(--accent);
          border: 2px solid #fff;
          box-shadow: 0 0 0 1px #ccc;
        }
        /* IE/Edge (legacy) */
        input[type="range"]::-ms-track {
          height: var(--track-height);
          border-color: transparent;
          color: transparent;
          background: transparent;
        }
        input[type="range"]::-ms-fill-lower {
          background: var(--accent);
          border-radius: 6px 0 0 6px;
        }
        input[type="range"]::-ms-fill-upper {
          background: #ccc;
          border-radius: 0 6px 6px 0;
        }
        input[type="range"]::-ms-thumb {
          width: var(--thumb-size);
          height: var(--thumb-size);
          border-radius: 50%;
          background: var(--accent);
          border: 2px solid #fff;
          box-shadow: 0 0 0 1px #ccc;
          margin-top: 0; /* not supported like webkit */
        }
        `}
      </style>

      <div className="flex flex-col p-4 bg-white min-h-screen">
        <h1 className="text-2xl font-bold mb-3">
          {displayName ? `${displayName} — ` : ""}Flex {Number(planData?.totalAmount ?? amount).toFixed(2)} over {selectedMonths}{" "}
          {selectedMonths === 1 ? "month" : "months"}
        </h1>

        {/* Slider */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold text-gray-800">Duration</span>
            <span className="text-xs font-bold px-2 py-1 rounded-full bg-[#F2F8FF] text-[#0B1A2B]">
              {sliderValue} mo
            </span>
          </div>

          <input
            type="range"
            min={serverMin ?? 12}
            max={serverMax ?? 12}
            step={1}
            value={sliderValue}
            onChange={(e) => {
              const v = Number(e.target.value);
              // live update for smooth thumb + fill
              setSliderValue(v);
            }}
            onMouseUp={() => {
              // commit on release
              if (sliderValue !== selectedMonths) setSelectedMonths(sliderValue);
            }}
            onTouchEnd={() => {
              if (sliderValue !== selectedMonths) setSelectedMonths(sliderValue);
            }}
            style={{
              // Smooth, live blue fill that follows the thumb (WebKit/Chromium/Edge)
              background:
                serverMin != null && serverMax != null && serverMax > serverMin
                  ? `linear-gradient(to right, ${ACCENT} 0%, ${ACCENT} ${fillPercent}%, #ccc ${fillPercent}%, #ccc 100%)`
                  : `#eee`,
            }}
            disabled={serverMin == null || serverMax == null}
          />
          <div className="flex justify-between text-sm font-medium mt-1">
            <span>{serverMin ?? "-"} mo</span>
            <span>{serverMax ?? "-" } mo</span>
          </div>
          {/* Note: Firefox uses ::-moz-range-progress for fill; our CSS above handles that automatically.
              Chromium-based browsers use the inline linear-gradient which tracks sliderValue live. */}
        </div>

        {/* Payment Plan */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-3">Payment Plan</h2>

          {planBusy ? (
            <div className="flex justify-center py-6">
              <div className="loader h-16 w-16" />
            </div>
          ) : showNoPlan ? (
            <div className="w-full py-10 flex items-center justify-center">
              <p className="text-gray-600">No plan available.</p>
            </div>
          ) : hasPlanData ? (
            <PaymentPlanMocking
              payments={mockPayments}
              totalAmount={Number(planData!.totalAmount ?? amount)}
              showChangeDateButton
              isCollapsed={false}
              initialDate={new Date(startDate)}
              onDateSelected={(d) => setStartDate(d.toISOString().split("T")[0])}
              interestFreeEnabled={true}
              interestFreeUsed={interestFreeUsed}
              interestRate={Number(planData!.periodInterestRate ?? 0)}
              apr={Number(planData!.apr ?? 0)}
              onInterestFreePress={() => setIsIFOpen(true)} // ← open web sheet
            />
          ) : (
            <div />
          )}
        </div>

        {/* Payment Method */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-3">Payment Method</h2>
          {methodsLoading ? (
            <div className="flex justify-center">
              <div className="loader h-16 w-16" />
            </div>
          ) : methodsError ? (
            <p className="text-red-500 text-sm">Failed to load payment methods.</p>
          ) : (
            <SelectedPaymentMethod selectedMethod={selectedMethod} onPress={openModal} />
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          {hasDueToday && (
            <button
              onClick={() => {
                if (!transactionType) {
                  toast.info("Missing transactionType");
                  return;
                }
                if (!hasPlanData && transactionType !== "SOTERIA_PAYMENT") {
                  toast.info("Missing plan");
                  return;
                }
                if (transactionType === "VIRTUAL_CARD" && !selectedMethod) {
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
                if (transactionType === "SOTERIA_PAYMENT" && (!paymentPlanId || !splitPaymentId)) {
                  toast.info(!paymentPlanId ? "paymentPlanId is required to customize." : "splitPaymentId is required to customize.");
                  return;
                }
                const req = buildRequestForCustomize();
                if (!req) {
                  toast.error("Could not build customize request");
                  return;
                }
                sessionStorage.setItem("unified_customize_payload", JSON.stringify(req));
                // 🔁 Navigate to the Remix route that hosts the customize screen
                navigate("/UnifiedPayCustomizeScreen");
              }}
              className="flex-1 border border-gray-300 rounded-lg py-3 font-bold"
            >
              Customize
            </button>
          )}

          <button
            onClick={handleFinish}
            disabled={unifiedPending}
            className={`flex-1 py-3 rounded-lg font-bold text-white ${
              unifiedPending ? "bg-gray-500 cursor-not-allowed" : "bg-black hover:bg-gray-800"
            }`}
          >
            {unifiedPending
              ? "Processing…"
              : transactionType === "VIRTUAL_CARD"
              ? "Finish & Issue Card"
              : hasDueToday
              ? "Pay & Finish"
              : "Finish"}
          </button>
        </div>
      </div>

      {/* Methods modal */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black bg-opacity-50 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
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
                        selectedMethod={selectedMethod ?? ({} as PaymentMethod)}
                        onSelect={(m) => {
                          setSelectedMethod(m);
                          setIsModalOpen(false);
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

export default UnifiedYearlyPaymentPlan;
