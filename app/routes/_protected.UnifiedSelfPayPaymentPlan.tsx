import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "@remix-run/react";
import { toast, Toaster } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { IoIosArrowBack } from "react-icons/io";

import { useCalculatePaymentPlan } from "~/hooks/useCalculatePaymentPlan";
import { useUserDetails } from "~/hooks/useUserDetails";
import { useMerchantDetail } from "~/hooks/useMerchantDetail";

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

interface SuperchargeDetailParam {
  superchargeId?: string;
  paymentMethodId?: string;
  amount: number | string;
}

const ACCENT = "#00BFFF";

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

function normalizeFreqStr(x?: string): PaymentFrequency | undefined {
  if (!x) return undefined;
  const v = x.toUpperCase();
  if (v === "BI_WEEKLY" || v === "BIWEEKLY") return "BI_WEEKLY";
  if (v === "MONTHLY") return "MONTHLY";
  return undefined;
}

type AnyTier = {
  frequency?: PaymentFrequency | string;
  freq?: PaymentFrequency | string;
  termType?: string;
  minTerm?: number;
  maxTerm?: number;
  min?: number;
  max?: number;
  minAmount?: string;
  maxAmount?: string;
};

function getTierFrequency(t: AnyTier): PaymentFrequency | undefined {
  return (
    normalizeFreqStr(t.frequency as string) ??
    normalizeFreqStr(t.freq as string) ??
    normalizeFreqStr(t.termType as string)
  );
}

function getTierMin(t: AnyTier): number | undefined {
  return t.minTerm ?? t.min;
}

function getTierMax(t: AnyTier): number | undefined {
  return t.maxTerm ?? t.max;
}

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  const s = (raw ?? "").trim();
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

function parseMoneyParam(raw: string | null | undefined): number | undefined {
  const s = (raw ?? "").trim();
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
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

const UnifiedSelfPayPaymentPlan: React.FC = () => {
  const navigate = useNavigate();
  const { search } = useLocation();
  const qs = new URLSearchParams(search);

  // -------------------- Read URL params --------------------
  const merchantId = normalizeStr(qs.get("merchantId"), "");
  const splitFlag = normalizeStr(qs.get("split"), "");
  const modeSplit = splitFlag === "true";

  const transactionTypeParam = normalizeStr(qs.get("transactionType"), "").toUpperCase();
  const transactionType: AllowedType | null = (ALLOWED_TYPES as readonly string[]).includes(
    transactionTypeParam as AllowedType
  )
    ? (transactionTypeParam as AllowedType)
    : null;

  const powerModeRaw = normalizeStr(qs.get("powerMode"), "INSTANT").toUpperCase();
  const isYearlyMode = powerModeRaw === "YEARLY";

  const discountListRawQS = normalizeStr(qs.get("discountList"), "");
  const requestId = normalizeStr(qs.get("requestId"), "");

  const paymentPlanId = normalizeStr(qs.get("paymentPlanId"), "") || undefined;
  const paymentSchemeId = normalizeStr(qs.get("paymentSchemeId"), "") || undefined;
  const splitPaymentId = normalizeStr(qs.get("splitPaymentId"), "") || undefined;

  const displayName = normalizeStr(qs.get("displayName"), "");
  const displayLogo = normalizeStr(qs.get("displayLogo"), "");
  const logoUriHint = normalizeStr(qs.get("logoUri"), "");

  // -------------------- AMOUNT PARSING (mobile parity) --------------------
  const amountFromParams = normalizeStr(qs.get("amount"), "0");
  const selfPayAmountStr = (amountFromParams || "0").toString().replace(/[$,\s]/g, "");
  const selfPayAmount = parseFloat(selfPayAmountStr) || 0;

  const amountParamOverride = normalizeStr(qs.get("amountParam"), "");
  const originalTotalStr = (amountParamOverride || amountFromParams || "0").toString().replace(/[$,\s]/g, "");
  const originalTotalAmount = parseFloat(originalTotalStr) || 0;

  const effectiveAmount = selfPayAmount;
  const amount = Number(effectiveAmount.toFixed(2));

  // -------------------- Parse supercharge details --------------------
  const rawSupercharge = normalizeStr(qs.get("superchargeDetails"), "[]");
  
  const superchargeDetails = useMemo<{ paymentMethodId: string; amount: number }[]>(() => {
    let parsedSupercharges: SuperchargeDetailParam[] = [];
    try {
      parsedSupercharges = JSON.parse(rawSupercharge);
    } catch {}

    return (Array.isArray(parsedSupercharges) ? parsedSupercharges : [])
      .filter(
        (s) =>
          typeof (s.paymentMethodId ?? s.superchargeId) === "string" &&
          (typeof s.amount === "number" || typeof s.amount === "string")
      )
      .map((s) => ({
        paymentMethodId: (s.paymentMethodId ?? s.superchargeId)!,
        amount: typeof s.amount === "string" ? parseFloat(s.amount) || 0 : s.amount,
      }))
      .filter((s) => s.amount > 0);
  }, [rawSupercharge]);

  const superchargeTotal = useMemo(
    () => superchargeDetails.reduce((sum, s) => sum + s.amount, 0),
    [superchargeDetails]
  );

  const totalWithSupercharge = effectiveAmount + superchargeTotal;

  const otherUsersRaw = normalizeStr(qs.get("otherUsers"), "[]");
  const otherUserAmounts = useMemo<SplitEntry[]>(() => {
    const arr = safeJsonParse<any[]>(otherUsersRaw, []);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x) => ({
        userId: String(x?.userId ?? ""),
        amount: String(x?.amount ?? "0"),
      }))
      .filter((x) => x.userId && Number.isFinite(Number(x.amount)) && Number(x.amount) >= 0);
  }, [otherUsersRaw]);

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

  const totalAmountParam = parseMoneyParam(qs.get("totalAmount"));

  useEffect(() => {
    try {
      console.log("[SelfPay/Soteria][Amount Resolution]", {
        amountParamOverride,
        amountFromParams,
        selfPayAmount,
        originalTotalAmount,
        effectiveAmount,
        superchargeTotal,
        totalWithSupercharge,
        superchargeDetails,
      });
    } catch {}
  }, [
    amountParamOverride,
    amountFromParams,
    selfPayAmount,
    originalTotalAmount,
    effectiveAmount,
    superchargeTotal,
    totalWithSupercharge,
    superchargeDetails,
  ]);

  const { data: userDetailsData, isLoading: userLoading } = useUserDetails();
  const currentUserId: string | undefined = userDetailsData?.data?.user?.id;
  const availableIF: number = Number(userDetailsData?.data?.interestFreeCreditAmount ?? 0);

  const {
    data: methods = [],
    isLoading: methodsLoading,
    isError: methodsError,
  } = usePaymentMethods(currentUserId);

  const {
    data: merchantResp,
    isLoading: merchantLoading,
    isError: merchantIsError,
    error: merchantErrorObj,
  } = useMerchantDetail(merchantId);

  const { mutate: calculatePlan, data: calculatedPlan } = useCalculatePaymentPlan();
  const { mutateAsync: runUnified, isPending: unifiedPending } = useUnifiedCommerce();

  const cfg = merchantResp?.data?.configuration;
  const isAcceptSplit = transactionType === "ACCEPT_SPLIT_REQUEST";
  const hasMerchantData = !!merchantResp?.data;

  const fallbackSelfPayEnabled = isAcceptSplit && !hasMerchantData;
  const selfPayEnabled = !!cfg?.enableSelfPay || fallbackSelfPayEnabled;

  const topMinRaw = hasMerchantData ? cfg?.minAmount?.amount : undefined;
  const topMaxRaw = hasMerchantData ? cfg?.maxAmount?.amount : undefined;

  const parsedTopMin = typeof topMinRaw === "number" ? topMinRaw : undefined;
  const parsedTopMax = typeof topMaxRaw === "number" ? topMaxRaw : undefined;

  const minAmount = parsedTopMin && parsedTopMin > 0 ? parsedTopMin : undefined;
  const maxAmount = parsedTopMax && parsedTopMax > 0 ? parsedTopMax : undefined;

  const withinMin = minAmount == null || amount >= minAmount;
  const withinMax = maxAmount == null || amount <= maxAmount;

  const tiers: AnyTier[] = hasMerchantData && Array.isArray(cfg?.selfPayTiers) ? (cfg!.selfPayTiers as AnyTier[]) : [];

  const fitsAnyTier = useMemo(() => {
    if (!tiers.length) return true;
    return tiers.some((t: AnyTier) => {
      const tMin = t.minAmount != null ? parseFloat(t.minAmount) : 0;
      const tMax = t.maxAmount != null ? parseFloat(t.maxAmount) : Number.POSITIVE_INFINITY;
      return amount >= tMin && amount <= tMax;
    });
  }, [tiers, amount]);

  const allowedFrequencies = useMemo<PaymentFrequency[]>(() => {
    const set = new Set<PaymentFrequency>();
    tiers.forEach((t: AnyTier) => {
      const f = getTierFrequency(t);
      if (f) set.add(f);
    });
    return set.size ? Array.from(set) : (["BI_WEEKLY", "MONTHLY"] as PaymentFrequency[]);
  }, [tiers]);

  const boundsByFreq = useMemo(() => {
    const map = new Map<PaymentFrequency, { min: number; max: number }>();
    allowedFrequencies.forEach((f: PaymentFrequency) => {
      const related = tiers.filter((t: AnyTier) => getTierFrequency(t) === f);
      const mins = related.map(getTierMin).filter((n): n is number => typeof n === "number");
      const maxs = related.map(getTierMax).filter((n): n is number => typeof n === "number");

      let min = mins.length ? Math.max(1, Math.min(...mins)) : 1;
      let max = maxs.length ? Math.max(min, Math.max(...maxs)) : f === "BI_WEEKLY" ? 26 : 12;

      if (fallbackSelfPayEnabled) {
        min = Math.max(min, 4);
        max = Math.max(max, min);
      }

      map.set(f, { min, max });
    });
    return map;
  }, [allowedFrequencies, tiers, fallbackSelfPayEnabled]);

  const [paymentFrequency, setPaymentFrequency] = useState<PaymentFrequency>("BI_WEEKLY");
  const [numberOfPeriods, setNumberOfPeriods] = useState("1");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [interestFreeUsed, setInterestFreeUsed] = useState<number>(0);
  const [freeInput, _setFreeInput] = useState<string>("");
  const setFreeInput = useCallback((v: string) => _setFreeInput(v), [_setFreeInput]);
  const [isIFOpen, setIsIFOpen] = useState<boolean>(false);

  const [planPending, setPlanPending] = useState<boolean>(true);
  const [planExplicitlyEmpty, setPlanExplicitlyEmpty] = useState<boolean>(false);

  const [minTerm, setMinTerm] = useState<number>(1);
  const [maxTerm, setMaxTerm] = useState<number>(12);

  useEffect(() => {
    if (!allowedFrequencies.length) return;
    if (!allowedFrequencies.includes(paymentFrequency)) {
      setPaymentFrequency(allowedFrequencies[0]);
    }
  }, [allowedFrequencies, paymentFrequency]);

  useEffect(() => {
    const b = boundsByFreq.get(paymentFrequency) ?? {
      min: 1,
      max: paymentFrequency === "BI_WEEKLY" ? 26 : 12,
    };
    const newMin = Math.max(1, Number(b.min ?? 1));
    const newMax = Math.max(newMin, Number(b.max ?? (paymentFrequency === "BI_WEEKLY" ? 26 : 12)));

    setMinTerm(newMin);
    setMaxTerm(newMax);

    const current = parseInt(numberOfPeriods, 10) || newMin;
    const clamped = Math.max(newMin, Math.min(current, newMax));
    if (String(clamped) !== numberOfPeriods) setNumberOfPeriods(String(clamped));
  }, [boundsByFreq, paymentFrequency, numberOfPeriods]);

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
    const fromQS = extractDiscountIds(discountListRawQS || undefined);
    return Array.from(new Set([...fromQS]));
  }, [discountListRawQS]);

  const hasDiscounts = parsedDiscountIds.length > 0;

  const planRequest = useMemo(() => {
    const raw = parseInt(numberOfPeriods, 10) || minTerm;
    const count = Math.max(minTerm, Math.min(raw, maxTerm));
    return {
      frequency: paymentFrequency as PaymentFrequency,
      numberOfPayments: count,
      purchaseAmount: amount,
      startDate,
      selfPay: true,
      instantaneous: !isYearlyMode,
      yearly: isYearlyMode,
      interestFreeAmt: Number(interestFreeUsed.toFixed(2)),
    };
  }, [paymentFrequency, numberOfPeriods, minTerm, maxTerm, amount, startDate, interestFreeUsed, isYearlyMode]);

  const lastCalcSig = useRef<string>("");

  useEffect(() => {
    const isSoteria = transactionType === "SOTERIA_PAYMENT";
    if (isSoteria) {
      setPlanPending(false);
      setPlanExplicitlyEmpty(false);
      return;
    }

    if (!selfPayEnabled) return;

    const eligible = fallbackSelfPayEnabled ? amount > 0 : withinMin && withinMax && fitsAnyTier;
    if (!eligible) {
      setPlanPending(false);
      setPlanExplicitlyEmpty(false);
      return;
    }

    if (amount <= 0) {
      setPlanPending(false);
      setPlanExplicitlyEmpty(false);
      return;
    }

    const sig = `${planRequest.frequency}|${planRequest.numberOfPayments}|${planRequest.purchaseAmount.toFixed(
      2
    )}|${planRequest.startDate}|${planRequest.interestFreeAmt.toFixed(2)}|${isYearlyMode ? "Y" : "N"}`;

    if (lastCalcSig.current === sig) return;
    lastCalcSig.current = sig;

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
  }, [
    transactionType,
    selfPayEnabled,
    fallbackSelfPayEnabled,
    withinMin,
    withinMax,
    fitsAnyTier,
    amount,
    planRequest,
    calculatePlan,
    isYearlyMode,
  ]);

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
    splitPaymentId?: string;
  };

  const buildCommonFields = useCallback(
    (plan: any | null): CommonWithDiscounts => {
      const splits = buildSplits(plan);

      const selfPayPlanAmount = Number(effectiveAmount.toFixed(2));
      const schemeTotalAmount = Number(totalWithSupercharge.toFixed(2));

      const others =
        isSplitFlow && currentUserId
          ? otherUsersNormalized
              .filter((u) => u.userId !== currentUserId)
              .map((u) => ({ userId: u.userId, amount: Number(u.amount) || 0 }))
          : isSplitFlow
          ? otherUsersNormalized.map((u) => ({ userId: u.userId, amount: Number(u.amount) || 0 }))
          : undefined;

      const discountIds = hasDiscounts ? parsedDiscountIds : undefined;

      const origTI = Number(plan?.originalTotalInterest);
      const currTI = Number(plan?.currentTotalInterest);
      const haveOrigTI = Number.isFinite(origTI);
      const haveCurrTI = Number.isFinite(currTI);

      const common: CommonWithDiscounts = {
        paymentFrequency,
        numberOfPayments: splits.length || Number(numberOfPeriods) || 1,
        offsetStartDate: splits[0]?.dueDate ?? startDate,
        instantAmount: 0,
        yearlyAmount: 0,
        selectedPaymentMethod: selectedPaymentMethod?.id,
        superchargeDetails: superchargeDetails.length > 0 ? superchargeDetails : [],
        splitSuperchargeDetails: [],
        selfPayActive: true,
        totalPlanAmount: Number(((plan?.totalAmount ?? calculatedPlan?.data?.totalAmount ?? effectiveAmount) || 0).toFixed(2)),
        interestFreeUsed: Number(interestFreeUsed.toFixed(2)),
        interestRate: Number(calculatedPlan?.data?.periodInterestRate ?? plan?.periodInterestRate ?? 0),
        apr: Number(calculatedPlan?.data?.apr ?? plan?.apr ?? 0),
        schemeTotalAmount,
        schemeAmount: selfPayPlanAmount,
        splitPaymentsList: splits,
        otherUsers: others,
        discountIds,
        ...(splitPaymentId ? { splitPaymentId } : {}),
      };

      if (haveOrigTI) common.originalTotalInterest = origTI;
      if (haveCurrTI) common.currentTotalInterest = currTI;

      try {
        console.debug("[SelfPay] CommonFields:", {
          superchargeDetails: common.superchargeDetails,
          selfPayPlanAmount,
          schemeTotalAmount,
          discountIds: hasDiscounts ? parsedDiscountIds : "(none)",
        });
      } catch {}

      return common;
    },
    [
      buildSplits,
      effectiveAmount,
      totalWithSupercharge,
      isSplitFlow,
      otherUsersNormalized,
      currentUserId,
      paymentFrequency,
      numberOfPeriods,
      startDate,
      selectedPaymentMethod?.id,
      superchargeDetails,
      calculatedPlan?.data?.totalAmount,
      calculatedPlan?.data?.periodInterestRate,
      calculatedPlan?.data?.apr,
      hasDiscounts,
      parsedDiscountIds,
      interestFreeUsed,
      splitPaymentId,
      calculatedPlan?.data,
    ]
  );

  const buildVirtualCardOptions = useCallback((): VirtualCardOptions => {
    return {};
  }, []);

  const buildSoteriaUnifiedRequest = useCallback(() => {
    const others =
      isSplitFlow && currentUserId
        ? otherUsersNormalized
            .filter((u) => u.userId !== currentUserId)
            .map((u) => ({ userId: u.userId, amount: Number(u.amount) || 0 }))
        : isSplitFlow
        ? otherUsersNormalized.map((u) => ({ userId: u.userId, amount: Number(u.amount) || 0 }))
        : undefined;

    const common = {
      ...(hasDiscounts ? { discountIds: parsedDiscountIds } : {}),
      ...(others ? { otherUsers: others } : {}),
      ...(splitPaymentId ? { splitPaymentId } : {}),
      selectedPaymentMethod: selectedPaymentMethod?.id ?? undefined,
      superchargeDetails: superchargeDetails.length > 0 ? superchargeDetails : [],
    };

    const soteriaPayload: Record<string, any> = {
      ...(paymentPlanId ? { paymentPlanId } : {}),
      ...(paymentSchemeId ? { paymentSchemeId } : {}),
      ...(splitPaymentId ? { splitPaymentId } : {}),
      ...(displayLogo ? { displayLogo } : {}),
      ...(displayName ? { displayName } : {}),
      ...(splitFlag ? { split: splitFlag } : {}),
      ...(logoUriHint ? { logoUri: logoUriHint } : {}),
    };

    const req = buildSoteriaPaymentRequest(
      {
        merchantId,
        soteriaPaymentTotalAmount: {
          amount: Number(totalWithSupercharge.toFixed(2)),
          currency: "USD",
        },
        paymentTotalAmount: {
          amount: Number(totalWithSupercharge.toFixed(2)),
          currency: "USD",
        },
        soteriaPayload,
        paymentPlanId: paymentPlanId ?? undefined,
        paymentSchemeId: paymentSchemeId ?? undefined,
        splitPaymentId: splitPaymentId ?? undefined,
      },
      common as any
    );

    return req;
  }, [
    isSplitFlow,
    otherUsersNormalized,
    currentUserId,
    hasDiscounts,
    parsedDiscountIds,
    splitPaymentId,
    selectedPaymentMethod?.id,
    superchargeDetails,
    paymentPlanId,
    paymentSchemeId,
    displayLogo,
    displayName,
    splitFlag,
    logoUriHint,
    merchantId,
    totalWithSupercharge,
  ]);

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
      console.log(`[UnifiedSelfPayPaymentPlan/web] Sending ${op} request:\n${json}`);
    } catch {
      console.log(`[UnifiedSelfPayPaymentPlan/web] Sending ${op} request (stringify failed).`, req);
    }
  }, []);

  const displayPlanTotal: number = Number((calculatedPlan?.data?.totalAmount ?? totalAmountParam ?? amount).toFixed(2));

  const navigateSuccess = (amt: number | string, checkoutToken?: string) => {
    const num = typeof amt === "number" ? amt : Number(amt || 0);
    const amountText = Number.isFinite(num) ? num.toFixed(2) : "0.00";
    const params = new URLSearchParams({
      amount: amountText,
      replace_to_index: "1",
      split: modeSplit ? "true" : "false",
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

    const isSoteria = transactionType === "SOTERIA_PAYMENT";
    if (!isSoteria && !calculatedPlan?.data && transactionType !== "SEND") {
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
        case "SOTERIA_PAYMENT": {
          if (!paymentPlanId || !splitPaymentId) {
            toast.error(!paymentPlanId ? "paymentPlanId is required." : "splitPaymentId is required.");
            return;
          }
          let req = buildSoteriaUnifiedRequest();
          req = sanitizeForType("SOTERIA_PAYMENT", req);
          try {
            console.debug("[SOTERIA] Sending request:", JSON.stringify(req));
          } catch {}
          logUnifiedPayload("SOTERIA_PAYMENT", req);
          await runUnified(req);
          navigateSuccess(totalWithSupercharge);
          break;
        }

        case "VIRTUAL_CARD": {
          const common: any = buildCommonFields(calculatedPlan?.data);
          const virtualCard: VirtualCardOptions = buildVirtualCardOptions();
          let req = buildVirtualCardRequestWithOptions(merchantId, virtualCard, common);
          req = sanitizeForType("VIRTUAL_CARD", req);
          try {
            console.debug("[SelfPay] Sending VIRTUAL_CARD request:", {
              superchargeDetails: common?.superchargeDetails ?? "(none)",
              discountIds: common?.discountIds ?? "(none)",
            });
          } catch {}
          logUnifiedPayload("VIRTUAL_CARD", req);
          await runUnified(req);

          if (isSplitFlow) {
            navigateSuccess(totalWithSupercharge);
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
          try {
            console.debug("[SelfPay] Sending CHECKOUT request:", {
              superchargeDetails: common?.superchargeDetails ?? "(none)",
              discountIds: common?.discountIds ?? "(none)",
            });
          } catch {}
          logUnifiedPayload("CHECKOUT", req);
          const res = await runUnified(req);

          const token =
            (res as any)?.checkout?.checkoutToken ??
            (res as any)?.checkout?.token ??
            (res as any)?.checkoutToken ??
            (res as any)?.token ??
            undefined;

          if (token) {
            try {
              setSession("checkoutToken", String(token));
            } catch {}
          }

          navigateSuccess(totalWithSupercharge, token);
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
          try {
            console.debug("[SelfPay] Sending PAYMENT request:", {
              superchargeDetails: common?.superchargeDetails ?? "(none)",
              discountIds: common?.discountIds ?? "(none)",
            });
          } catch {}
          logUnifiedPayload("PAYMENT", req);
          await runUnified(req);
          navigateSuccess(totalWithSupercharge);
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
          try {
            console.debug("[SelfPay] Sending SEND request:", {
              superchargeDetails: common?.superchargeDetails ?? "(none)",
              discountIds: common?.discountIds ?? "(none)",
            });
          } catch {}
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
          try {
            console.debug("[SelfPay] Sending ACCEPT_REQUEST:", {
              superchargeDetails: common?.superchargeDetails ?? "(none)",
              discountIds: common?.discountIds ?? "(none)",
            });
          } catch {}
          logUnifiedPayload("ACCEPT_REQUEST", req);
          await runUnified(req);
          navigateSuccess(totalWithSupercharge);
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
          try {
            console.debug("[SelfPay] Sending ACCEPT_SPLIT_REQUEST:", {
              superchargeDetails: common?.superchargeDetails ?? "(none)",
              discountIds: common?.discountIds ?? "(none)",
            });
          } catch {}
          logUnifiedPayload("ACCEPT_SPLIT_REQUEST", req);
          await runUnified(req);
          navigateSuccess(totalWithSupercharge);
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

  const isSoteria = transactionType === "SOTERIA_PAYMENT";

  const isBootLoading =
    userLoading || methodsLoading || merchantLoading || (!isSoteria && planPending) || unifiedPending;

  const bootErrorMsg =
    (merchantIsError ? (merchantErrorObj as any)?.message || "Failed to load merchant." : "") || "";

  const blockUnavailable =
    !isSoteria &&
    !isAcceptSplit &&
    (!selfPayEnabled || !(fallbackSelfPayEnabled ? amount > 0 : withinMin && withinMax && fitsAnyTier));

  const showNoPlan = !isSoteria && !planPending && planExplicitlyEmpty && amount > 0;

  useEffect(() => {
    try {
      console.log("[SelfPay][Availability Check]", {
        effectiveAmount,
        superchargeTotal,
        totalWithSupercharge,
        enableSelfPay: cfg?.enableSelfPay,
        fallbackSelfPayEnabled,
        hasMerchantData,
        minAmount,
        maxAmount,
        withinMin,
        withinMax,
        tiers,
        fitsAnyTier,
        isSoteria,
      });
    } catch {}
  }, [
    effectiveAmount,
    superchargeTotal,
    totalWithSupercharge,
    cfg?.enableSelfPay,
    fallbackSelfPayEnabled,
    hasMerchantData,
    minAmount,
    maxAmount,
    withinMin,
    withinMax,
    tiers,
    fitsAnyTier,
    isSoteria,
  ]);

  const applyFree = () => {
    const val = Math.min(Number(freeInput || "0") || 0, availableIF, displayPlanTotal);
    setInterestFreeUsed(val);
    setIsIFOpen(false);
  };

  if (isBootLoading) return <CenterSpinner />;

  if (bootErrorMsg) {
    return (
      <>
        <div className="min-h-screen bg-white">
          <header className="flex items-center p-4">
            <button onClick={() => navigate(-1)} className="flex items-center text-gray-700 hover:text-gray-900">
              <IoIosArrowBack className="mr-2" size={24} />
              Back
            </button>
          </header>
          <div className="flex items-center justify-center p-6">
            <p className="text-red-600 text-center">{bootErrorMsg}</p>
          </div>
        </div>
        <Toaster richColors position="top-right" />
      </>
    );
  }

  if (blockUnavailable) {
    return (
      <>
        <div className="min-h-screen bg-white">
          <header className="flex items-center p-4">
            <button onClick={() => navigate(-1)} className="flex items-center text-gray-700 hover:text-gray-900">
              <IoIosArrowBack className="mr-2" size={24} />
              Back
            </button>
          </header>
          <div className="flex items-center justify-center p-6">
            <p className="text-red-600 text-center">Self-Pay is not available for this merchant or amount.</p>
          </div>
        </div>
        <Toaster richColors position="top-right" />
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-white">
        {/* Header with back button */}
        <header className="flex items-center p-4">
          <button onClick={() => navigate(-1)} className="flex items-center text-gray-700 hover:text-gray-900">
            <IoIosArrowBack className="mr-2" size={24} />
            Back
          </button>
        </header>

        <div className="px-6 pb-6">
          <h1 className="text-2xl font-bold mb-2">
            {`${displayName ? `${displayName} — ` : ""}${isSoteria ? "Soteria" : "Flex"} $${amount.toFixed(2)}`}
          </h1>

          {!isSoteria && (
            <p className="text-sm text-gray-600 mb-4">
              Plan total: <span className="font-semibold">${displayPlanTotal.toFixed(2)}</span>
            </p>
          )}

          {/* Supercharge Summary Container */}
          {superchargeTotal > 0 && (
            <div className="bg-sky-50 p-3 rounded-lg mb-4 border border-sky-200">
              <p className="text-sm text-sky-700 font-medium">
                Supercharge: ${superchargeTotal.toFixed(2)} • Total: ${totalWithSupercharge.toFixed(2)}
              </p>
            </div>
          )}

          {/* Periods + Frequency (NOT for Soteria) */}
          {!isSoteria && (
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Number of periods</label>
                <select
                  value={numberOfPeriods}
                  onChange={(e) => setNumberOfPeriods(e.target.value)}
                  className="w-full p-2 border rounded-md shadow-sm focus:ring-black focus:border-black"
                >
                  {Array.from({ length: maxTerm - minTerm + 1 }, (_, i) => i + minTerm).map((v) => (
                    <option key={v} value={String(v)}>
                      {v}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Allowed: {minTerm}–{maxTerm}{" "}
                  {paymentFrequency === "BI_WEEKLY" ? "periods (bi-weekly)" : "periods (monthly)"}
                </p>
              </div>

              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Payment frequency</label>
                <select
                  value={paymentFrequency}
                  onChange={(e) => setPaymentFrequency(e.target.value as PaymentFrequency)}
                  className="w-full p-2 border rounded-md shadow-sm focus:ring-black focus:border-black"
                >
                  {allowedFrequencies.map((f) => (
                    <option key={f} value={f}>
                      {f === "BI_WEEKLY" ? "Bi-weekly" : "Monthly"}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Plan preview (NOT for Soteria) */}
          {!isSoteria && (
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
                  totalAmount={displayPlanTotal}
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
          )}

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
                  ((isSoteria || transactionType === "SEND" || !!calculatedPlan?.data) &&
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
              {unifiedPending ? "Processing…" : isSoteria ? "Pay with Soteria" : hasDueToday ? "Pay & Finish" : "Finish"}
            </button>
          </div>
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
                        selectedMethod={selectedPaymentMethod}
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
        originalAmount={displayPlanTotal}
        freeInput={freeInput}
        setFreeInput={setFreeInput}
        applyFree={applyFree}
      />

      <Toaster richColors position="top-right" />
    </>
  );
};

export default UnifiedSelfPayPaymentPlan;