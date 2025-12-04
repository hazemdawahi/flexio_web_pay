// File: app/routes/UnifiedSelfPayPaymentPlan.tsx
// Web Self-Pay / Soteria screen aligned with the RN UnifiedSelfPayPaymentPlan logic.
// All monetary amounts are in DOLLARS (major units). No *100 anywhere.

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "@remix-run/react";
import { toast, Toaster } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { IoIosArrowBack } from "react-icons/io";

import SelectedPaymentMethod from "~/compoments/SelectedPaymentMethod";
import PaymentPlanMocking from "~/compoments/PaymentPlanMocking";
import PaymentMethodItem from "~/compoments/PaymentMethodItem";

import { usePaymentMethods, type PaymentMethod } from "~/hooks/usePaymentMethods";
import { useCalculatePaymentPlan, type SplitPayment as CalcSplitPayment } from "~/hooks/useCalculatePaymentPlan";
import { useUserDetails } from "~/hooks/useUserDetails";
import { useMerchantDetail } from "~/hooks/useMerchantDetail";
import { useAvailableDiscounts } from "~/hooks/useAvailableDiscounts";

// ✅ Unified commerce builders (parity with RN)
import {
  useUnifiedCommerce,
  buildVirtualCardRequestWithOptions,
  buildPaymentRequest,
  buildCheckoutRequest,
  buildSendRequest,
  buildAcceptRequest,
  buildAcceptSplitRequest,
  buildSoteriaPaymentRequest,
  type VirtualCardOptions,
  type SplitPaymentDetail,
  type SendRecipient,
  type UnifiedCommerceRequest,
} from "~/hooks/useUnifiedCommerce";
import InterestFreeSheet from "~/compoments/InterestFreeSheet";

/** ---------------- Small helpers ---------------- */
const ACCENT = "#00BFFF";
const BASE_URL = "http://localhost:8080";
const makeFullUrl = (p?: string | null) =>
  !p ? undefined : /^https?:\/\//.test(p) ? p : `${BASE_URL}${p.startsWith("/") ? p : `/${p}`}`;

/* ✅ Session helpers for checkout token persistence */
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
  } catch {
    // ignore storage errors
  }
};

const sanitizeParamString = (raw?: string | null) => {
  const s = (raw ?? "").trim();
  if (!s) return "";
  const low = s.toLowerCase();
  if (low === "null" || low === "undefined") return "";
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
};
const normalizeParam = (v: string | null | undefined, fallback = ""): string =>
  sanitizeParamString(v ?? fallback);

const canonicalizeDiscountList = (raw: string): string => {
  if (!raw || !raw.trim()) return "[]";
  const extractId = (x: any): string => {
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
    if (Array.isArray(parsed)) return JSON.stringify(uniq(parsed.map(extractId)));
    if (typeof parsed === "string") return JSON.stringify(uniq(parsed.split(",").map((s) => s.trim())));
  } catch {
    return JSON.stringify(uniq(raw.split(",").map((s) => s.trim())));
  }
  return "[]";
};

// 🔢 Safe coercion similar to our customize screen
function toNumberFromMoneyLike(m: any): number {
  if (m == null) return 0;
  if (typeof m === "number") return Number.isFinite(m) ? m : 0;
  if (typeof m === "string") {
    const parts = m.trim().split(/\s+/);
    const last = parts[parts.length - 1];
    const n = Number(last);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof m === "object" && m.amount != null) {
    const n = Number(m.amount);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** ---------------- Local unions / types ---------------- */
type PaymentFrequency = "BI_WEEKLY" | "MONTHLY";

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

// 🔧 Local wide union that *does* include SOTERIA_PAYMENT
type AllowedTypeWeb =
  | "CHECKOUT"
  | "PAYMENT"
  | "SEND"
  | "ACCEPT_REQUEST"
  | "ACCEPT_SPLIT_REQUEST"
  | "VIRTUAL_CARD"
  | "SOTERIA_PAYMENT";

const ALLOWED_TYPES_WEB: readonly AllowedTypeWeb[] = [
  "CHECKOUT",
  "PAYMENT",
  "SEND",
  "ACCEPT_REQUEST",
  "ACCEPT_SPLIT_REQUEST",
  "VIRTUAL_CARD",
  "SOTERIA_PAYMENT",
] as const;

function normalizeFreqStr(x?: string): PaymentFrequency | undefined {
  if (!x) return undefined;
  const v = x.toUpperCase();
  if (v === "BI_WEEKLY" || v === "BIWEEKLY") return "BI_WEEKLY";
  if (v === "MONTHLY") return "MONTHLY";
  return undefined;
}
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

/** Center spinner (unified design) */
const CenterSpinner: React.FC<{ label?: string }> = ({ label = "Loading…" }) => (
  <div className="min-h-[50vh] w-full flex flex-col items-center justify-center bg-white">
    <motion.div
      role="status"
      aria-label="Loading"
      className="w-10 h-10 rounded-full border-4 border-gray-300"
      style={{ borderTopColor: "#000" }}
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, ease: "linear", duration: 0.9 }}
    />
    <p className="mt-3 text-sm text-gray-700">{label}</p>
  </div>
);

const UnifiedSelfPayPaymentPlan: React.FC = () => {
  const navigate = useNavigate();
  const { search } = useLocation();
  const qs = new URLSearchParams(search);

  // -------------------- PARAMS (normalized) --------------------
  const getParam = (k: string, def = "") => normalizeParam(qs.get(k), def);
  const getParamOpt = (k: string) => {
    const v = qs.get(k);
    return v == null ? undefined : normalizeParam(v);
  };

  // Core identifiers
  const merchantId = getParam("merchantId", "");
  const requestId = getParam("requestId", "");

  // Flow context (exact keys sent by UnifiedPlansOptions)
  const transactionTypeRaw = getParam("transactionType", "");
  const txString = (transactionTypeRaw || "").toUpperCase();
  const transactionType: AllowedTypeWeb | null = (ALLOWED_TYPES_WEB as readonly string[]).includes(
    txString as AllowedTypeWeb
  )
    ? (txString as AllowedTypeWeb)
    : null;

  // Amounts (major-unit dollars)
  const amountParamOverride = getParamOpt("amountParam");
  const amountFromParams = getParam("amount", "0");
  const orderAmount = getParam("orderAmount", ""); // forwarded passthrough
  const totalAmount = getParam("totalAmount", ""); // forwarded passthrough

  // Effective chosen amount
  const chosenAmountStr = (amountParamOverride ?? amountFromParams) || "0";
  const effectiveAmount = parseFloat(chosenAmountStr.toString().replace(/[$,\s]/g, "")) || 0;

  // Discounts forwarded as JSON array of IDs (canonicalized by source, but we re-canon safely)
  const discountListRaw = canonicalizeDiscountList(getParam("discountList", "[]"));

  // Split/send extras (not always present for Self-Pay)
  const otherUsersRaw = getParam("otherUsers", "[]");
  const recipientRaw = getParam("recipient", "");

  // Branding passthrough (param wins; merchant fallback in data section)
  const displayLogo = getParam("displayLogo", "");
  const displayName = getParam("displayName", "");
  const logoUriHint = getParam("logoUri", "");
  const splitFlag = getParam("split", "");

  // Soteria IDs
  const paymentPlanId = getParam("paymentPlanId", "");
  const paymentSchemeId = getParam("paymentSchemeId", "");
  const splitPaymentId = getParam("splitPaymentId", "");

  // ---- LOG: show exactly what we received
  useEffect(() => {
    console.groupCollapsed("[UnifiedSelfPayPaymentPlan] URL Params (normalized)");
    console.table([
      { key: "merchantId", value: merchantId },
      { key: "transactionType", value: txString },
      { key: "amount", value: amountFromParams },
      { key: "amountParam", value: amountParamOverride ?? "" },
      { key: "orderAmount", value: orderAmount },
      { key: "totalAmount", value: totalAmount },
      { key: "effectiveAmount", value: effectiveAmount },
      { key: "discountList(raw)", value: discountListRaw },
      { key: "requestId", value: requestId },
      { key: "displayLogo", value: displayLogo },
      { key: "displayName", value: displayName },
      { key: "logoUri", value: logoUriHint },
      { key: "split", value: splitFlag },
      { key: "paymentPlanId", value: paymentPlanId },
      { key: "paymentSchemeId", value: paymentSchemeId },
      { key: "splitPaymentId", value: splitPaymentId },
      { key: "otherUsers", value: otherUsersRaw ? "(json)" : "" },
      { key: "recipient", value: recipientRaw ? "(json)" : "" },
    ]);
    console.groupEnd();
  }, [
    merchantId,
    txString,
    amountFromParams,
    amountParamOverride,
    orderAmount,
    totalAmount,
    effectiveAmount,
    discountListRaw,
    requestId,
    displayLogo,
    displayName,
    logoUriHint,
    splitFlag,
    paymentPlanId,
    paymentSchemeId,
    splitPaymentId,
    otherUsersRaw,
    recipientRaw,
  ]);

  // -------------------- HOOKS --------------------
  const { data: userDetailsData } = useUserDetails();
  const currentUserId = userDetailsData?.data?.user?.id;
  const availableIF = Number(userDetailsData?.data?.interestFreeCreditAmount ?? 0); // ← available interest-free

  const {
    data: merchantDetailData,
    isLoading: merchantLoading,
    error: merchantError,
  } = useMerchantDetail(merchantId);

  // ⚠️ usePaymentMethods now returns PaymentMethod[] directly
  const { data: methods, isLoading: methodsLoading, isError: methodsIsError } = usePaymentMethods(currentUserId);

  const { mutate: calculatePlan, data: calculatedPlan } = useCalculatePaymentPlan();
  const { mutateAsync: runUnified, isPending: unifiedPending } = useUnifiedCommerce();

  // Discounts available from API for this merchant + amount
  const {
    data: discounts = [],
    isLoading: discountsLoading,
    error: discountsError,
  } = useAvailableDiscounts(merchantId, effectiveAmount);

  // -------------------- DISCOUNT STATE (seed from param if provided) --------------------
  const [discountList, setDiscountList] = useState<string[]>([]);
  const hasDiscounts = discountList.length > 0;

  useEffect(() => {
    try {
      const arr = JSON.parse(discountListRaw);
      if (Array.isArray(arr)) {
        const sanitized = arr.map((x: any) => String(x)).filter(Boolean);
        if (sanitized.length) setDiscountList(sanitized);
      }
    } catch {
      // ignore
    }
  }, [discountListRaw]);

  // -------------------- MERCHANT CONFIG & TIERS --------------------
  const cfg = merchantDetailData?.data?.configuration;
  const hasMerchantData = !!merchantDetailData?.data;

  const isAcceptSplit = txString === "ACCEPT_SPLIT_REQUEST";
  const fallbackSelfPayEnabled = isAcceptSplit && !hasMerchantData;

  const selfPayEnabled = !!cfg?.enableSelfPay || fallbackSelfPayEnabled;

  // 🔧 MIN/MAX from config (treat 0 as “no max”)
  const topMinRaw = hasMerchantData ? cfg?.minAmount?.amount : undefined;
  const topMaxRaw = hasMerchantData ? cfg?.maxAmount?.amount : undefined;

  const minAmount = topMinRaw != null ? Math.max(0, parseFloat(String(topMinRaw))) : undefined;

  // If max is 0 or negative, consider it "no maximum" (unbounded)
  let maxAmount: number | undefined = topMaxRaw != null ? parseFloat(String(topMaxRaw)) : undefined;
  if (maxAmount != null && maxAmount <= 0) {
    maxAmount = undefined;
  }

  const withinMin = minAmount == null || effectiveAmount >= minAmount;
  const withinMax = maxAmount == null || effectiveAmount <= maxAmount;

  const tiers: AnyTier[] =
    hasMerchantData && Array.isArray(cfg?.selfPayTiers) ? (cfg!.selfPayTiers as AnyTier[]) : [];

  const fitsAnyTier = useMemo(() => {
    if (!tiers.length) return true;
    return tiers.some((t) => {
      const tMin = t.minAmount != null ? parseFloat(String(t.minAmount)) : 0;
      const tMax =
        t.maxAmount != null && parseFloat(String(t.maxAmount)) > 0
          ? parseFloat(String(t.maxAmount))
          : Number.POSITIVE_INFINITY;
      return effectiveAmount >= tMin && effectiveAmount <= tMax;
    });
  }, [tiers, effectiveAmount]);

  const allowedFrequencies = useMemo<PaymentFrequency[]>(() => {
    const set = new Set<PaymentFrequency>();
    tiers.forEach((t) => {
      const f = getTierFrequency(t);
      if (f) set.add(f);
    });
    return set.size ? Array.from(set) : (["BI_WEEKLY", "MONTHLY"] as PaymentFrequency[]);
  }, [tiers]);

  const boundsByFreq = useMemo(() => {
    const map = new Map<PaymentFrequency, { min: number; max: number }>();
    allowedFrequencies.forEach((f) => {
      const related = tiers.filter((t) => getTierFrequency(t) === f);
      const mins = related.map(getTierMin).filter((n): n is number => typeof n === "number");
      const maxs = related.map(getTierMax).filter((n): n is number => typeof n === "number");

      let min = mins.length ? Math.max(1, Math.min(...mins)) : 1;
      let max = maxs.length ? Math.max(min, Math.max(...maxs)) : (f === "BI_WEEKLY" ? 26 : 12);

      if (fallbackSelfPayEnabled) {
        min = Math.max(min, 4);
        max = Math.max(max, min);
      }
      map.set(f, { min, max });
    });
    return map;
  }, [allowedFrequencies, tiers, fallbackSelfPayEnabled]);

  // -------------------- LOCAL UI STATE --------------------
  const [paymentFrequency, setPaymentFrequency] = useState<PaymentFrequency>("BI_WEEKLY");
  const [numberOfPeriods, setNumberOfPeriods] = useState<string>("1");
  const [startDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ✅ Interest-free state (web parity)
  const [interestFreeUsed, setInterestFreeUsed] = useState<number>(0);
  const [freeInput, setFreeInput] = useState<string>("");
  const [isIFOpen, setIsIFOpen] = useState<boolean>(false);
  const digitsOnly = (s: string) => s.replace(/\D+/g, "");
  const handleIFChange = (v: string) => setFreeInput(digitsOnly(v));
  const applyIF = () => {
    const total = discountedTotal; // apply against discounted total
    const val = Math.min(Number(freeInput) || 0, availableIF, total);
    setInterestFreeUsed(val);
    setIsIFOpen(false);
  };

  // Section spinner & empty state tracking
  const [planBusy, setPlanBusy] = useState<boolean>(false);
  const [planExplicitlyEmpty, setPlanExplicitlyEmpty] = useState<boolean>(false);

  // 🎯 If current frequency is NOT allowed by tiers, snap to the first allowed one
  useEffect(() => {
    if (!allowedFrequencies.length) return;
    if (!allowedFrequencies.includes(paymentFrequency)) {
      setPaymentFrequency(allowedFrequencies[0]);
    }
  }, [allowedFrequencies, paymentFrequency]);

  // Initialize periods to lower bound once bounds are known (and keep it in-range)
  useEffect(() => {
    const b = boundsByFreq.get(paymentFrequency);
    if (!b) return;
    const next = String(Math.max(b.min, Math.min(parseInt(numberOfPeriods || "0", 10) || b.min, b.max)));
    if (next !== numberOfPeriods) setNumberOfPeriods(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundsByFreq, paymentFrequency]);

  // Preselect payment method (first card; prefer primary if present)
  useEffect(() => {
    const list = methods ?? [];
    if (list.length && !selectedPaymentMethod) {
      const cards = list.filter((m) => m.type === "card");
      const primary = cards.find((m) => (m as any)?.card?.primary === true);
      setSelectedPaymentMethod(primary ?? cards[0] ?? null);
    }
  }, [methods, selectedPaymentMethod]);

  // ---------- Normalized values used for FIRST calc
  const normalizedFrequency = useMemo<PaymentFrequency>(() => {
    return allowedFrequencies.includes(paymentFrequency)
      ? paymentFrequency
      : (allowedFrequencies[0] ?? "BI_WEEKLY");
  }, [allowedFrequencies, paymentFrequency]);

  const normalizedBounds = useMemo(() => {
    return boundsByFreq.get(normalizedFrequency) ?? { min: 1, max: 12 };
  }, [boundsByFreq, normalizedFrequency]);

  const normalizedCount = useMemo(() => {
    const raw = parseInt(numberOfPeriods || "0", 10) || normalizedBounds.min;
    return Math.max(normalizedBounds.min, Math.min(raw, normalizedBounds.max));
  }, [numberOfPeriods, normalizedBounds]);

  // Merchant readiness gate
  const merchantReady = hasMerchantData || fallbackSelfPayEnabled;

  // Sync pickers once to normalized defaults when merchant is ready
  const didSyncDefaultsRef = useRef(false);
  useEffect(() => {
    if (didSyncDefaultsRef.current) return;
    if (!merchantReady) return;
    if (!fallbackSelfPayEnabled && allowedFrequencies.length === 0) return;

    setPaymentFrequency((prev) =>
      allowedFrequencies.includes(prev) ? prev : normalizedFrequency
    );
    setNumberOfPeriods(String(normalizedCount));
    didSyncDefaultsRef.current = true;
  }, [
    merchantReady,
    allowedFrequencies.length,
    fallbackSelfPayEnabled,
    normalizedFrequency,
    normalizedCount,
    allowedFrequencies,
  ]);

  // -------------------- PLAN CALC (classic Self-Pay only) --------------------
  const lastCalcSig = useRef<string>("");

  // BACKEND expects "BI_WEEKLY" (not "BIWEEKLY")
  const apiFrequency = (f: PaymentFrequency): "BI_WEEKLY" | "MONTHLY" =>
    f === "BI_WEEKLY" ? "BI_WEEKLY" : "MONTHLY";

  // Reset dedupe signature when key inputs change
  useEffect(() => {
    lastCalcSig.current = "";
  }, [merchantReady, effectiveAmount, normalizedCount, normalizedFrequency]);

  const triggerPlanCalc = useCallback(
    (count: number, freq: PaymentFrequency, amount: number, force = false) => {
      if (txString === "SOTERIA_PAYMENT") return;
      if (!(amount > 0)) return;

      const sig = `${freq}|${count}|${amount.toFixed(2)}`;
      if (!force && lastCalcSig.current === sig) return; // prevent redundant calls
      lastCalcSig.current = sig;

      const payload = {
        frequency: apiFrequency(freq), // <-- server enum
        numberOfPayments: count,
        purchaseAmount: amount,
        startDate,
        selfPay: true,
        instantaneous: false,
        yearly: false,
        interestFreeAmt: 0,
      };

      setPlanBusy(true);
      setPlanExplicitlyEmpty(false);

      console.log("[useCalculatePaymentPlan] → payload", payload);

      const timeout = setTimeout(() => {
        setPlanBusy(false);
      }, 10000);

      calculatePlan(payload as any, {
        onSuccess: (res: any) => {
          clearTimeout(timeout);
          console.log("[useCalculatePaymentPlan] ✓ success", res);
          const empty =
            !!res?.success &&
            (!res.data || !Array.isArray(res.data.splitPayments) || res.data.splitPayments.length === 0);
          setPlanExplicitlyEmpty(empty);
          setPlanBusy(false);
        },
        onError: (err: any) => {
          clearTimeout(timeout);
          console.warn("[useCalculatePaymentPlan] ✗ error", err);
          setPlanExplicitlyEmpty(false);
          setPlanBusy(false);
          toast.error("Could not calculate plan.");
        },
      });
    },
    [calculatePlan, txString, startDate]
  );

  // 🎯 Drive plan calculation with *normalized* values (so plan renders on first load)
  useEffect(() => {
    if (txString === "SOTERIA_PAYMENT") return;
    if (!merchantReady) return;
    if (!fallbackSelfPayEnabled && allowedFrequencies.length === 0) return;

    const eligible = fallbackSelfPayEnabled ? effectiveAmount > 0 : withinMin && withinMax && fitsAnyTier;
    if (!eligible || !(effectiveAmount > 0)) {
      setPlanBusy(false);
      setPlanExplicitlyEmpty(false);
      return;
    }

    // Force the very first call when ready so we don't “wait for a user change”
    triggerPlanCalc(normalizedCount, normalizedFrequency, effectiveAmount, true);
  }, [
    txString,
    merchantReady,
    allowedFrequencies.length,
    fallbackSelfPayEnabled,
    withinMin,
    withinMax,
    fitsAnyTier,
    effectiveAmount,
    normalizedCount,
    normalizedFrequency,
    triggerPlanCalc,
  ]);

  const planData = calculatedPlan?.data;
  const mockPayments: CalcSplitPayment[] = useMemo(() => {
    if (!planData) return [];
    return planData.splitPayments.map((p: any) => ({
      dueDate: p.dueDate,
      amount: p.amount,
      originalAmount: p.originalAmount ?? p.amount,
      interestFreeSlice: p.interestFreeSlice ?? 0,
      interestRate: p.interestRate ?? 0,
      interestAmount: p.interestAmount ?? 0,
      originalInterestAmount: p.originalInterestAmount ?? 0,
    }));
  }, [planData]);

  // -------------------- DISCOUNTS (auto-pick if none was pre-selected) --------------------
  const getDiscountValue = (d: any): number => {
    if (d.type === "PERCENTAGE_OFF" && d.discountPercentage != null) {
      return effectiveAmount * (d.discountPercentage / 100);
    } else if (d.discountAmount != null) {
      return Number(d.discountAmount);
    }
    return 0;
  };

  const didAutoPick = useRef(false);
  useEffect(() => {
    if (discountList.length) {
      didAutoPick.current = true;
      return;
    }
    if (!didAutoPick.current && discounts.length) {
      const valid = discounts.filter((d: any) => effectiveAmount - getDiscountValue(d) >= 0);
      if (valid.length) {
        const best = valid.reduce((a: any, b: any) => (getDiscountValue(b) > getDiscountValue(a) ? b : a));
        setDiscountList([String(best.id)]);
      }
      didAutoPick.current = true;
    }
  }, [discounts, effectiveAmount, discountList.length]);

  const discountedTotalBeforeIF = useMemo(() => {
    const id = discountList[0];
    const found = discounts.find((d: any) => String(d.id) === id);
    const val = found ? getDiscountValue(found) : 0;
    return Math.max(0, effectiveAmount - val);
  }, [discountList, discounts, effectiveAmount]);

  // ✅ Final payable total after interest-free
  const discountedTotal = Math.max(0, discountedTotalBeforeIF - interestFreeUsed);

  const handleDiscountChange = (id: string | number) => {
    const sid = String(id);
    setDiscountList((prev) => (prev.includes(sid) ? [] : [sid]));
  };

  // -------------------- SPLIT / RECIPIENT --------------------
  const allSplitUsers = useMemo<{ userId: string; amount: number }[]>(() => {
    try {
      const arr = JSON.parse(otherUsersRaw);
      return Array.isArray(arr)
        ? arr
            .map((u: any) => ({ userId: String(u?.userId ?? ""), amount: Number(u?.amount ?? 0) }))
            .filter((u) => !!u.userId)
        : [];
    } catch {
      return [];
    }
  }, [otherUsersRaw]);

  // EXCLUDE the current user when determining split and when building otherUsers payload
  const splitUsersExcludingSelf = useMemo(() => {
    if (!currentUserId) return allSplitUsers;
    return allSplitUsers.filter((u) => u.userId !== currentUserId);
  }, [allSplitUsers, currentUserId]);

  const isSplitFlow = splitUsersExcludingSelf.length > 0;

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

  // -------------------- BUILD HELPERS --------------------
  const buildSplits = useCallback((): SplitPaymentDetail[] => {
    return (mockPayments || []).map((p) => ({
      dueDate: p.dueDate,
      amount: Number(p.amount ?? 0),
      originalAmount: Number(p.originalAmount ?? 0),
      interestFreeSlice: Number(p.interestFreeSlice ?? 0),
      interestRate: Number(p.interestRate ?? 0),
      interestAmount: Number(p.interestAmount ?? 0),
      originalInterestAmount: Number(p.originalInterestAmount ?? 0),
    }));
  }, [mockPayments]);

  const buildOtherUsersExcludingSelf = useCallback(() => {
    if (!splitUsersExcludingSelf.length) return undefined;
    return splitUsersExcludingSelf.map((u) => ({ userId: u.userId, amount: Number(u.amount) || 0 }));
  }, [splitUsersExcludingSelf]);

  const buildCommonFields = useCallback(() => {
    const splits = buildSplits();
    const schemeAmount = Number(discountedTotal.toFixed(2));
    const others = buildOtherUsersExcludingSelf();

    const common: any = {
      paymentFrequency: normalizedFrequency, // keep UI freq semantic here
      numberOfPayments: splits.length || Number(numberOfPeriods) || 1,
      offsetStartDate: mockPayments[0]?.dueDate ?? startDate,
      instantAmount: 0,
      yearlyAmount: 0,
      selectedPaymentMethod: selectedPaymentMethod?.id,
      superchargeDetails: [],
      splitSuperchargeDetails: [],
      selfPayActive: true,
      totalPlanAmount: Number(((planData?.totalAmount ?? discountedTotal)).toFixed(2)),
      interestFreeUsed: Number(interestFreeUsed.toFixed(2)),
      interestRate: Number(planData?.periodInterestRate ?? 0),
      apr: Number(planData?.apr ?? 0),
      schemeAmount, // ← matches CommonPlanFields
      splitPaymentsList: splits,
      ...(others ? { otherUsers: others } : {}),
      ...(discountList.length ? { discountIds: discountList } : {}),
      ...(splitPaymentId ? { splitPaymentId } : {}),
    };
    return common;
  }, [
    buildSplits,
    buildOtherUsersExcludingSelf,
    normalizedFrequency,
    numberOfPeriods,
    mockPayments,
    startDate,
    selectedPaymentMethod?.id,
    planData?.totalAmount,
    planData?.periodInterestRate,
    planData?.apr,
    discountedTotal,
    discountList,
    splitPaymentId,
    interestFreeUsed,
  ]);

  const buildVirtualCardOptions = useCallback((): VirtualCardOptions => {
    return {};
  }, []);

  const buildSoteriaUnifiedRequest = useCallback((): UnifiedCommerceRequest => {
    const others = buildOtherUsersExcludingSelf();
    const common = {
      ...(discountList.length ? { discountIds: discountList } : {}),
      ...(others ? { otherUsers: others } : {}),
      ...(splitPaymentId ? { splitPaymentId } : {}),
      selectedPaymentMethod: selectedPaymentMethod?.id ?? undefined,
      interestFreeUsed: Number(interestFreeUsed.toFixed(2)),
    };

    const soteriaPayload: Record<string, any> = {
      ...(paymentPlanId ? { paymentPlanId } : {}),
      ...(paymentSchemeId ? { paymentSchemeId } : {}),
      ...(splitPaymentId ? { splitPaymentId } : {}),
      ...(displayLogo ? { displayLogo } : {}),
      ...(displayName ? { displayName } : {}),
      // ⬇️ pass split flag computed from other users (exclude self)
      split: isSplitFlow ? "true" : "false",
      ...(logoUriHint ? { logoUri: logoUriHint } : {}),
    };

    const req = buildSoteriaPaymentRequest(
      {
        merchantId,
        soteriaPaymentTotalAmount: { amount: Number(discountedTotal.toFixed(2)), currency: "USD" },
        paymentTotalAmount: { amount: Number(discountedTotal.toFixed(2)), currency: "USD" },
        soteriaPayload,
        paymentPlanId: paymentPlanId || undefined,
        paymentSchemeId: paymentSchemeId || undefined,
        splitPaymentId: splitPaymentId || undefined,
      },
      common as any
    );

    return req;
  }, [
    buildOtherUsersExcludingSelf,
    discountList,
    splitPaymentId,
    selectedPaymentMethod?.id,
    paymentPlanId,
    paymentSchemeId,
    displayLogo,
    displayName,
    logoUriHint,
    merchantId,
    discountedTotal,
    interestFreeUsed,
    isSplitFlow,
  ]);

  // Defensive sanitizer using string literal for `type`
  function sanitizeForType<T extends Record<string, any>>(type: AllowedTypeWeb, req: T): T {
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

  // -------------------- ACTIONS --------------------
  const payloadReadyClassic = Boolean(selectedPaymentMethod && mockPayments.length > 0);
  const requireMethod =
    txString !== "ACCEPT_REQUEST" && txString !== "ACCEPT_SPLIT_REQUEST" && txString !== "SEND";
  const payloadReady = txString === "SOTERIA_PAYMENT" ? Boolean(selectedPaymentMethod) : payloadReadyClassic;

  const handleConfirm = async () => {
    if (!transactionType) {
      toast.info("Missing transactionType param.");
      return;
    }
    if (requireMethod && !selectedPaymentMethod) {
      toast.info("Select a payment method first.");
      return;
    }
    if (!merchantId) {
      toast.info("Missing merchant id.");
      return;
    }

    try {
      switch (txString as AllowedTypeWeb) {
        case "SOTERIA_PAYMENT": {
          if (!paymentPlanId || !paymentSchemeId) {
            toast.info("Missing Soteria details (paymentPlanId & paymentSchemeId).");
            return;
          }
          let req = buildSoteriaUnifiedRequest();
          req = sanitizeForType("SOTERIA_PAYMENT", req);
          const res: any = await runUnified(req);

          // Determine amount & token from response when possible
          let amount = toNumberFromMoneyLike(
            res?.soteriaPayment?.totalAmount ??
              res?.soteriaPayment?.soteriaPaymentTotalAmount ??
              discountedTotal
          );
          if (!(amount > 0)) amount = Number(discountedTotal.toFixed(2));
          const token =
            res?.checkout?.checkoutToken || res?.checkout?.token || res?.token || "";

          // ✅ persist returned token for future requests
          if (token) setSession("checkoutToken", String(token));

          const qAmount = encodeURIComponent(amount.toFixed(2));
          const qToken = token ? `&checkoutToken=${encodeURIComponent(token)}` : "";
          const qSplit = `&split=${isSplitFlow ? "true" : "false"}`;
          navigate(`/SuccessPayment?amount=${qAmount}${qToken}${qSplit}&replace_to_index=1`);
          break;
        }

        case "VIRTUAL_CARD": {
          if (!payloadReadyClassic) {
            toast.info("Wait for plan calculation to finish.");
            return;
          }
          const common = buildCommonFields();
          const vc: VirtualCardOptions = buildVirtualCardOptions();
          let req = buildVirtualCardRequestWithOptions(merchantId, vc, common);
          req = sanitizeForType("VIRTUAL_CARD", req);
          const res: any = await runUnified(req);

          let amount =
            toNumberFromMoneyLike(res?.totalAmount) ||
            toNumberFromMoneyLike(res?.amount) ||
            Number(discountedTotal.toFixed(2));
          const token =
            res?.checkout?.checkoutToken || res?.checkout?.token || res?.token || "";

          if (token) setSession("checkoutToken", String(token));

          const qAmount = encodeURIComponent(amount.toFixed(2));
          const qToken = token ? `&checkoutToken=${encodeURIComponent(token)}` : "";
          const qSplit = `&split=${isSplitFlow ? "true" : "false"}`;
          // ✅ Go to success (not /card-details)
          navigate(`/SuccessPayment?amount=${qAmount}${qToken}${qSplit}&replace_to_index=1`);
          break;
        }

        case "PAYMENT": {
          const common = buildCommonFields();
          let req = buildPaymentRequest(
            { merchantId, paymentTotalAmount: { amount: Number(discountedTotal.toFixed(2)), currency: "USD" } },
            common
          );
          req = sanitizeForType("PAYMENT", req);
          const res: any = await runUnified(req);

          let amount =
            toNumberFromMoneyLike(res?.totalAmount) ||
            toNumberFromMoneyLike(res?.amount) ||
            toNumberFromMoneyLike(res?.payment?.amount) ||
            Number(discountedTotal.toFixed(2));
          const token =
            res?.checkout?.checkoutToken || res?.checkout?.token || res?.token || "";

          if (token) setSession("checkoutToken", String(token));

          const qAmount = encodeURIComponent(amount.toFixed(2));
          const qToken = token ? `&checkoutToken=${encodeURIComponent(token)}` : "";
          const qSplit = `&split=${isSplitFlow ? "true" : "false"}`;
          navigate(`/SuccessPayment?amount=${qAmount}${qToken}${qSplit}&replace_to_index=1`);
          break;
        }

        case "CHECKOUT": {
          const common = buildCommonFields();

          // ✅ include existing token from session to continue checkout session
          const sessionCheckoutToken = getSession("checkoutToken");
          console.log("[UnifiedSelfPayPaymentPlan] Using checkoutToken from session:", sessionCheckoutToken);

          // ⛔️ NO checkoutTotalAmount in new DTO — only pass allowed top-level keys
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
          req = sanitizeForType("CHECKOUT", req);
          const res: any = await runUnified(req);

          let amount =
            toNumberFromMoneyLike(res?.totalAmount) ||
            toNumberFromMoneyLike(res?.amount) ||
            Number(discountedTotal.toFixed(2));
          const token =
            res?.checkout?.checkoutToken || res?.checkout?.token || res?.token || "";

          // ✅ persist returned token
          if (token) setSession("checkoutToken", String(token));

          const qAmount = encodeURIComponent(amount.toFixed(2));
          const qToken = token ? `&checkoutToken=${encodeURIComponent(token)}` : "";
          const qSplit = `&split=${isSplitFlow ? "true" : "false"}`;
          navigate(`/SuccessPayment?amount=${qAmount}${qToken}${qSplit}&replace_to_index=1`);
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
          const res: any = await runUnified(req);

          let amount =
            toNumberFromMoneyLike(res?.send?.amount) ||
            toNumberFromMoneyLike(res?.send?.transferredAmount) ||
            toNumberFromMoneyLike(res?.send?.totalAmount) ||
            toNumberFromMoneyLike(res?.transfer?.amount) ||
            toNumberFromMoneyLike(res?.transfer?.transferredAmount) ||
            toNumberFromMoneyLike(res?.transfer?.totalAmount) ||
            Number((+recipientObj.amount).toFixed(2));
          const token =
            res?.checkout?.checkoutToken || res?.checkout?.token || res?.token || "";

          if (token) setSession("checkoutToken", String(token));

          const qAmount = encodeURIComponent(amount.toFixed(2));
          const qToken = token ? `&checkoutToken=${encodeURIComponent(token)}` : "";
          const qSplit = `&split=${isSplitFlow ? "true" : "false"}`;
          navigate(`/SuccessPayment?amount=${qAmount}${qToken}${qSplit}&replace_to_index=1`);
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
          const res: any = await runUnified(req);

          let amount =
            toNumberFromMoneyLike(res?.totalAmount) ||
            toNumberFromMoneyLike(res?.amount) ||
            Number(discountedTotal.toFixed(2));
          const token =
            res?.checkout?.checkoutToken || res?.checkout?.token || res?.token || "";

          if (token) setSession("checkoutToken", String(token));

          const qAmount = encodeURIComponent(amount.toFixed(2));
          const qToken = token ? `&checkoutToken=${encodeURIComponent(token)}` : "";
          const qSplit = `&split=${isSplitFlow ? "true" : "false"}`;
          navigate(`/SuccessPayment?amount=${qAmount}${qToken}${qSplit}&replace_to_index=1`);
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
          const res: any = await runUnified(req);

          let amount =
            toNumberFromMoneyLike(res?.totalAmount) ||
            toNumberFromMoneyLike(res?.amount) ||
            Number(discountedTotal.toFixed(2));
          const token =
            res?.checkout?.checkoutToken || res?.checkout?.token || res?.token || "";

          if (token) setSession("checkoutToken", String(token));

          const qAmount = encodeURIComponent(amount.toFixed(2));
          const qToken = token ? `&checkoutToken=${encodeURIComponent(token)}` : "";
          const qSplit = `&split=${isSplitFlow ? "true" : "false"}`;
          navigate(`/SuccessPayment?amount=${qAmount}${qToken}${qSplit}&replace_to_index=1`);
          break;
        }
      }
    } catch (e: any) {
      console.error("Unified SelfPay/Soteria (web) error:", e?.message || e);
      toast.error("Operation failed. Try again.");
    }
  };

  // -------------------- RENDER HELPERS --------------------
  const renderPaymentMethodSection = () => {
    if (methodsLoading) {
      return (
        <div className="flex justify-center">
          <div
            className="w-10 h-10 rounded-full border-4 border-gray-300 animate-spin"
            style={{ borderTopColor: "#000" }}
          />
        </div>
      );
    }
    if (methodsIsError) {
      return <p className="text-red-500">Error fetching payment methods</p>;
    }
    return <SelectedPaymentMethod selectedMethod={selectedPaymentMethod} onPress={() => setIsModalOpen(true)} />;
  };

  const merchantBrand = merchantDetailData?.data?.brand;
  const logoUri = logoUriHint || makeFullUrl(merchantBrand?.displayLogo ?? undefined);

  const isSoteria = txString === "SOTERIA_PAYMENT";

  // ✅ Unified page-level loading (do NOT include planBusy; let plan section load in-page)
  const pageLoading = merchantLoading || methodsLoading || discountsLoading;

  const bootErrorMsg = (merchantError as any)?.message || (discountsError as any)?.message || "";

  const currentBounds = isSoteria ? { min: 1, max: 1 } : boundsByFreq.get(paymentFrequency) ?? { min: 1, max: 12 };
  const periodOptions = useMemo(
    () => Array.from({ length: currentBounds.max - currentBounds.min + 1 }, (_, i) => currentBounds.min + i),
    [currentBounds.min, currentBounds.max]
  );

  const today = new Date().toISOString().split("T")[0];
  const firstDueToday = isSoteria ? true : mockPayments[0]?.dueDate === today;

  const blockUnavailable =
    !isSoteria &&
    txString !== "ACCEPT_SPLIT_REQUEST" &&
    (!selfPayEnabled || !(fallbackSelfPayEnabled ? effectiveAmount > 0 : withinMin && withinMax && fitsAnyTier));

  const showNoPlan = !isSoteria && !pageLoading && planExplicitlyEmpty;

  return (
    <>
      <div className="min-h-screen bg-white">
        {/* 🔙 Back button — identical styling to UnifiedPlans */}
        <header className="flex items-center p-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-gray-700 hover:text-gray-900"
            aria-label="Go back"
          >
            <IoIosArrowBack className="mr-2" size={24} />
            Back
          </button>
        </header>

        {/* Page content */}
        <div className="px-4">
          {/* Loading / errors (unified style) */}
          {pageLoading ? (
            <CenterSpinner />
          ) : bootErrorMsg ? (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
              <h1 className="text-2xl font-bold">Error</h1>
              <p className="mt-2 text-red-600">{bootErrorMsg}</p>
            </div>
          ) : blockUnavailable ? (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
              <h1 className="text-2xl font-bold">Self-Pay Unavailable</h1>
              <p className="mt-2 text-gray-700">Not available for this merchant or amount.</p>
            </div>
          ) : showNoPlan ? (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
              <h1 className="text-2xl font-bold">No payment plan available.</h1>
            </div>
          ) : (
            <>
              {logoUri && (
                <img
                  src={logoUri}
                  alt={displayName || merchantBrand?.displayName || "Brand"}
                  className="w-20 h-20 rounded-full object-cover border border-gray-300 mx-auto mb-4"
                  onError={(e) => {
                    console.warn("[UnifiedSelfPayPaymentPlan] Logo failed to load:", logoUri);
                    (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                  }}
                  onLoad={() => console.log("[UnifiedSelfPayPaymentPlan] Logo loaded:", logoUri)}
                />
              )}

              <div className="flex items-center justify-between mb-5">
                <h1 className="text-2xl font-bold">
                  {isSoteria ? "Soteria" : "Flex"} ${discountedTotal.toFixed(2)}
                </h1>
                <span />
              </div>

              {/* Periods & Frequency (hide for Soteria) */}
              {!isSoteria && (
                <div className="space-y-4 mb-5">
                  <div>
                    <label htmlFor="numberOfPeriods" className="block mb-1 text-sm font-medium text-gray-700">
                      Number of Periods
                    </label>
                    <select
                      id="numberOfPeriods"
                      value={numberOfPeriods}
                      onChange={(e) => setNumberOfPeriods(e.target.value)}
                      className="w-full p-2 border rounded shadow-sm focus:outline-none focus:ring"
                    >
                      {periodOptions.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="paymentFrequency" className="block mb-1 text-sm font-medium text-gray-700">
                      Payment Frequency
                    </label>
                    <select
                      id="paymentFrequency"
                      value={paymentFrequency}
                      onChange={(e) => setPaymentFrequency(e.target.value as PaymentFrequency)}
                      className="w-full p-2 border rounded shadow-sm focus:outline-none focus:ring"
                    >
                      {Array.from(new Set(allowedFrequencies)).map((freq) => (
                        <option key={freq} value={freq}>
                          {freq === "BI_WEEKLY" ? "Bi-weekly" : "Monthly"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Plan Preview (hide when Soteria) */}
              {!isSoteria && (
                <>
                  {planBusy && !mockPayments.length ? (
                    <div className="mb-5">
                      <CenterSpinner label="Calculating plan…" />
                    </div>
                  ) : null}

                  {!!mockPayments.length && (
                    <div className="mb-5">
                      <h2 className="text-xl font-semibold mb-3">Payment Plan</h2>
                      <PaymentPlanMocking
                        payments={mockPayments}
                        showChangeDateButton={false}
                        isCollapsed={false}
                        totalAmount={planData?.totalAmount ?? discountedTotal}
                        /** 🔒 Disable interest-free interactions & chip within the plan preview */
                        interestFreeEnabled={false}
                        interestFreeUsed={interestFreeUsed}
                        onInterestFreePress={() => setIsIFOpen(true)}
                      />
                    </div>
                  )}
                </>
              )}

              {/* Discounts */}
              {discounts.length > 0 && (
                <div className="mb-5">
                  <h2 className="text-xl font-semibold mb-3">Available Discounts</h2>
                  {discountsLoading ? (
                    <p>Loading discounts…</p>
                  ) : discountsError ? (
                    <p className="text-red-500">Error loading discounts</p>
                  ) : (
                    <ul>
                      {discounts.map((d: any) => {
                        const disabled = effectiveAmount - getDiscountValue(d) < 0;
                        const sid = String(d.id);
                        return (
                          <li
                            key={d.id}
                            onClick={() => !disabled && handleDiscountChange(d.id)}
                            className={`flex items-center justify-between border p-2 mb-2 rounded cursor-pointer ${
                              disabled ? "opacity-50 cursor-not-allowed" : ""
                            }`}
                          >
                            <div className="flex items-center">
                              {merchantDetailData?.data?.brand?.displayLogo && (
                                <img
                                  src={
                                    merchantDetailData.data.brand.displayLogo.startsWith("http")
                                      ? merchantDetailData.data.brand.displayLogo
                                      : `${BASE_URL}${merchantDetailData.data.brand.displayLogo}`
                                  }
                                  alt={merchantDetailData.data.brand.displayName || ""}
                                  className="w-10 h-10 rounded-full object-cover mr-4 border border-gray-300"
                                />
                              )}
                              <div>
                                <p className="font-bold">{d.discountName}</p>
                                <p>
                                  {d.type === "PERCENTAGE_OFF"
                                    ? `${d.discountPercentage}% off`
                                    : `$${Number(d.discountAmount ?? 0).toFixed(2)} off`}
                                </p>
                                {d.expiresAt && (
                                  <p className="text-sm text-gray-500">
                                    Expires: {new Date(d.expiresAt).toLocaleString()}
                                  </p>
                                )}
                              </div>
                            </div>
                            <input
                              type="radio"
                              name="discount"
                              checked={discountList.includes(sid)}
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
                <h2 className="text-xl font-semibold mb-3">Payment Method</h2>
                {renderPaymentMethodSection()}
              </div>

              {/* Buttons (added extra space below with mb-10) */}
              <div className="flex flex-row gap-3 mb-10">
                {!isSoteria && (firstDueToday || isAcceptSplit) && (
                  <button
                    onClick={() => {
                      if (!transactionType) return toast.info("Missing transactionType");
                      const needsMethod =
                        txString !== "SEND" && txString !== "ACCEPT_REQUEST" && txString !== "ACCEPT_SPLIT_REQUEST";
                      if (needsMethod && !payloadReady) {
                        toast.info("Select method first");
                        return;
                      }

                      let fullReq: UnifiedCommerceRequest | null = null;
                      switch (txString as AllowedTypeWeb) {
                        case "SOTERIA_PAYMENT": {
                          if (!paymentPlanId || !paymentSchemeId) {
                            toast.info("Missing Soteria details (paymentPlanId & paymentSchemeId).");
                            return;
                          }
                          fullReq = buildSoteriaUnifiedRequest();
                          break;
                        }
                        case "VIRTUAL_CARD": {
                          const common = buildCommonFields();
                          const vc: VirtualCardOptions = buildVirtualCardOptions();
                          fullReq = buildVirtualCardRequestWithOptions(merchantId, vc, common);
                          break;
                        }
                        case "PAYMENT": {
                          const common = buildCommonFields();
                          fullReq = buildPaymentRequest(
                            { merchantId, paymentTotalAmount: { amount: Number(discountedTotal.toFixed(2)), currency: "USD" } },
                            common
                          );
                          break;
                        }
                        case "CHECKOUT": {
                          const common = buildCommonFields();

                          // ✅ include session checkout token when building customize request
                          const sessionCheckoutToken = getSession("checkoutToken");
                          console.log("[UnifiedSelfPayPaymentPlan/Customize] Using checkoutToken from session:", sessionCheckoutToken);

                          // ⛔️ Do not pass checkoutTotalAmount (not in the new DTO)
                          fullReq = buildCheckoutRequest(
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
                          break;
                        }
                        case "SEND": {
                          if (!recipientObj) {
                            toast.info("Provide a valid single recipient JSON.");
                            return;
                          }
                          const common = buildCommonFields();
                          fullReq = buildSendRequest(recipientObj, { senderId: "", note: "Transfer" }, common);
                          break;
                        }
                        case "ACCEPT_REQUEST": {
                          if (!requestId) {
                            toast.info("Missing requestId for ACCEPT_REQUEST.");
                            return;
                          }
                          const common = buildCommonFields();
                          fullReq = buildAcceptRequest(requestId, common);
                          break;
                        }
                        case "ACCEPT_SPLIT_REQUEST": {
                          if (!requestId) {
                            toast.info("Missing requestId for ACCEPT_SPLIT_REQUEST.");
                            return;
                          }
                          const common = buildCommonFields();
                          fullReq = buildAcceptSplitRequest(requestId, common);
                          break;
                        }
                      }

                      if (!fullReq) {
                        toast.error("Could not build customize request");
                        return;
                      }

                      try {
                        sessionStorage.setItem("unified_customize_payload", JSON.stringify(fullReq));
                      } catch {}
                      navigate("/UnifiedPayCustomizeScreen");
                    }}
                    className="flex-1 bg-white border border-gray-300 text-black font-semibold py-3 rounded-lg"
                  >
                    Customize
                  </button>
                )}

                <button
                  onClick={handleConfirm}
                  disabled={
                    unifiedPending ||
                    (requireMethod && !payloadReady) ||
                    (!isSoteria && !mockPayments.length) ||
                    discountedTotal === 0
                  }
                  className={`flex-1 py-3 font-bold text-white rounded-lg ${
                    unifiedPending ||
                    (requireMethod && !payloadReady) ||
                    (!isSoteria && !mockPayments.length) ||
                    discountedTotal === 0
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-black hover:bg-gray-800"
                  }`}
                >
                  {unifiedPending
                    ? "Processing…"
                    : txString === "VIRTUAL_CARD"
                    ? "Pay & Issue Card"
                    : txString === "SOTERIA_PAYMENT"
                    ? `Pay with Soteria $${discountedTotal.toFixed(2)}`
                    : `Self Pay $${discountedTotal.toFixed(2)}`}
                </button>
              </div>
            </>
          )}
        </div>
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
              >
                {/* Removed Payment Settings button as requested */}
                <h2 className="px-4 pt-4 mb-4 text-xl font-semibold">Select Payment Method</h2>
                <div className="space-y-4 px-4 pb-4">
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
        originalAmount={discountedTotalBeforeIF}
        freeInput={freeInput}
        setFreeInput={handleIFChange}
        applyFree={applyIF}
      />

      <Toaster richColors />
    </>
  );
};

export default UnifiedSelfPayPaymentPlan;
