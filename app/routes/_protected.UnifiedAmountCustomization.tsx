import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Toaster, toast } from "sonner";
import { IoIosArrowBack } from "react-icons/io";
import { motion, AnimatePresence } from "framer-motion";

import FloatingLabelInputOverdraft from "~/compoments/FloatingLabelInputOverdraft";
import FloatingLabelInputWithInstant from "~/compoments/FloatingLabelInputWithInstant";
import PaymentMethodItem from "~/compoments/PaymentMethodItem";

import { useMerchantDetail } from "~/hooks/useMerchantDetail";
import { useUserDetails } from "~/hooks/useUserDetails";
import { usePaymentMethods, type PaymentMethod } from "~/hooks/usePaymentMethods";

// clientLoader for SPA mode - runs before component renders
export const clientLoader = async () => {
  return { timestamp: Date.now() };
};

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
  type SendRecipient,
} from "~/hooks/useUnifiedCommerce";

type AllowedTransactionType =
  | "CHECKOUT"
  | "PAYMENT"
  | "SEND"
  | "ACCEPT_REQUEST"
  | "ACCEPT_SPLIT_REQUEST"
  | "VIRTUAL_CARD"
  | "SOTERIA_PAYMENT";

type PowerMode = "INSTANT" | "YEARLY" | "SUPERCHARGE" | "SELFPAY";

interface SuperchargeField {
  amount: string;
  selectedPaymentMethod: PaymentMethod | null;
  selectedPaymentMethodId?: string | null;
}

type SavedDraft = {
  powerMode: PowerMode;
  instantPowerAmount: string;
  superchargeFields: { amount: string; selectedPaymentMethodId: string | null }[];
};

const __UAC_MEMORY__: Record<string, SavedDraft> = Object.create(null);
const memKey = (merchantId?: string, tx?: string) =>
  `uac:${merchantId || "nomid"}:${(tx || "NA").toUpperCase()}`;

const isBrowser = typeof window !== "undefined";

function resolveBaseUrl(): string {
  // Vite-style env vars
  const fromEnv =
    import.meta.env.VITE_API_HOST ||
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_BASE_URL;

  if (fromEnv && typeof fromEnv === "string" && fromEnv.trim().length > 0) {
    return fromEnv.replace(/\/+$/, "");
  }

  if (isBrowser) {
    try {
      const loc = window.location;
      const protocol = loc.protocol === "https:" ? "https:" : "http:";
      const host = loc.hostname;
      const port = "8080";
      const built = `${protocol}//${host}:${port}`;
      return built;
    } catch {
      // fallback
    }
  }

  return "http://localhost:8080";
}

const BASE_URL = resolveBaseUrl();

const isAbsoluteUrl = (u?: string | null) => !!u && /^https?:\/\//i.test(u);
const isDicebearUrl = (u?: string | null) => !!u && /(^https?:\/\/)?([^/]*\.)?api\.dicebear\.com/i.test(u);

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
const normalizeParam = (v: string | string[] | null, fallback = ""): string =>
  sanitizeParamString(Array.isArray(v) ? v[0] : v ?? fallback);

function resolveLogoUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (isAbsoluteUrl(path) || isDicebearUrl(path)) return path;

  const base = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

function canonicalizeDiscountList(raw: string): string {
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
}

const toCents = (v: string | number): number => {
  const n = typeof v === "number" ? v : parseFloat(v || "0");
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
};
const centsToMajor = (c: number) => c / 100;

const getSession = (key: string): string | null => {
  try {
    if (typeof window === "undefined") return null;
    return window.sessionStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

function getUsedMethodIds(fields: SuperchargeField[], excludeIndex?: number): Set<string> {
  const ids = new Set<string>();
  fields.forEach((f, idx) => {
    if (excludeIndex !== undefined && idx === excludeIndex) return;
    if (f.selectedPaymentMethod?.id) {
      ids.add(f.selectedPaymentMethod.id);
    }
  });
  return ids;
}

const UnifiedAmountCustomization: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const merchantId = normalizeParam(searchParams.get("merchantId"), "");
  const amountParam = normalizeParam(searchParams.get("amount"), "");
  const amountParamOverride = normalizeParam(searchParams.get("amountParam"), "");
  const totalAmount = normalizeParam(searchParams.get("totalAmount"), "");
  const orderAmount = normalizeParam(searchParams.get("orderAmount"), "");

  const discountListRaw = normalizeParam(searchParams.get("discountList"), "[]");
  const powerModeParam = normalizeParam(searchParams.get("powerMode"), "INSTANT");
  const requestId = normalizeParam(searchParams.get("requestId"), "");
  const transactionTypeRaw = normalizeParam(searchParams.get("transactionType"), "");

  const otherUsersJson = normalizeParam(searchParams.get("otherUsers"), "");
  const recipientJson = normalizeParam(searchParams.get("recipient"), "");

  const displayLogoParam = normalizeParam(searchParams.get("displayLogo"), "");
  const displayNameParam = normalizeParam(searchParams.get("displayName"), "");
  const logoUriParam = normalizeParam(searchParams.get("logoUri"), "");

  const split = normalizeParam(searchParams.get("split"), "");
  const paymentPlanId = normalizeParam(searchParams.get("paymentPlanId"), "");
  const paymentSchemeId = normalizeParam(searchParams.get("paymentSchemeId"), "");
  const splitPaymentId = normalizeParam(searchParams.get("splitPaymentId"), "");
  const selfPayParam = normalizeParam(searchParams.get("selfPay"), "false");

  useEffect(() => {
    console.groupCollapsed("[UAC] URL Params (normalized]");
    console.table([
      { key: "merchantId", value: merchantId },
      { key: "amount", value: amountParam },
      { key: "amountParam", value: amountParamOverride },
      { key: "orderAmount", value: orderAmount },
      { key: "totalAmount", value: totalAmount },
      { key: "discountList", value: discountListRaw },
      { key: "powerMode", value: powerModeParam },
      { key: "transactionType", value: transactionTypeRaw },
      { key: "requestId", value: requestId },
      { key: "displayLogo", value: displayLogoParam },
      { key: "displayName", value: displayNameParam },
      { key: "logoUri", value: logoUriParam },
      { key: "split(param)", value: split },
      { key: "paymentPlanId", value: paymentPlanId },
      { key: "paymentSchemeId", value: paymentSchemeId },
      { key: "splitPaymentId", value: splitPaymentId },
      { key: "selfPay", value: selfPayParam },
      { key: "otherUsers(raw)", value: otherUsersJson ? otherUsersJson : "" },
    ]);
    if (otherUsersJson) {
      try {
        console.log("[UAC] otherUsers(parsed):", JSON.parse(otherUsersJson));
      } catch {}
    }
    if (recipientJson) {
      try {
        console.log("[UAC] recipient(parsed):", JSON.parse(recipientJson));
      } catch {}
    }
    console.groupEnd();
  }, [
    merchantId,
    amountParam,
    amountParamOverride,
    orderAmount,
    totalAmount,
    discountListRaw,
    powerModeParam,
    transactionTypeRaw,
    requestId,
    displayLogoParam,
    displayNameParam,
    logoUriParam,
    split,
    paymentPlanId,
    paymentSchemeId,
    splitPaymentId,
    selfPayParam,
    otherUsersJson,
    recipientJson,
  ]);

  const txUpper = (transactionTypeRaw || "").toUpperCase() as AllowedTransactionType | "";
  const isSend = txUpper === "SEND";
  const isAccept = txUpper === "ACCEPT_REQUEST";
  const isSoteria = txUpper === "SOTERIA_PAYMENT";

  const isRestrictedToInstant = isSend || isAccept;

  const rawPower = (powerModeParam || "INSTANT").toUpperCase() as PowerMode;
  const parsedPower: PowerMode =
    rawPower === "INSTANT" || rawPower === "YEARLY" || rawPower === "SUPERCHARGE" || rawPower === "SELFPAY"
      ? rawPower
      : "INSTANT";
  const powerMode: PowerMode = isRestrictedToInstant ? "INSTANT" : parsedPower;
  const isSupercharge = powerMode === "SUPERCHARGE";
  const isSelfPay = powerMode === "SELFPAY" || selfPayParam === "true";

  const discountListCanonical = useMemo(() => canonicalizeDiscountList(discountListRaw), [discountListRaw]);

  const { data: userRes, isLoading: loadingUser, refetch: refetchUser } = useUserDetails();
  const userId: string | undefined = userRes?.data?.user?.id;
  const instantaneousPower = userRes?.data?.user?.instantaneousPower ?? 0;
  const subscribed = userRes?.data?.subscribed ?? false;

  const {
    data: methodsArray,
    isLoading: loadingMethods,
    error: methodsError,
    refetch: refetchMethods,
  } = usePaymentMethods(userId);

  const preferParamsBranding = !!(logoUriParam || displayLogoParam);
  const {
    data: merchantRes,
    isLoading: loadingMerchant,
    error: merchantError,
    refetch: refetchMerchant,
  } = useMerchantDetail(preferParamsBranding ? "" : merchantId);

  const brandLogoFromMerchant = merchantRes?.data?.brand?.displayLogo ?? null;
  const brandNameFromMerchant = merchantRes?.data?.brand?.displayName ?? "";

  const computedLogoUri =
    logoUriParam ||
    (displayLogoParam
      ? resolveLogoUrl(displayLogoParam)
      : brandLogoFromMerchant
      ? resolveLogoUrl(brandLogoFromMerchant)
      : undefined);

  const headerName = displayNameParam || brandNameFromMerchant || "";

  const parseRecipient = useCallback((): SendRecipient | null => {
    const s = recipientJson;
    if (!s) return null;
    try {
      const o = JSON.parse(s);
      const rid = String(o?.recipientId || "");
      const amt = Number(o?.amount || 0);
      if (!rid || !Number.isFinite(amt) || amt <= 0) return null;
      return { recipientId: rid, amount: amt };
    } catch {
      return null;
    }
  }, [recipientJson]);

  const baseAmount = parseFloat(amountParamOverride || amountParam || "") || 0;
  const baseCents = toCents(baseAmount);
  const parsedOtherUsers = useMemo(() => {
    if (!otherUsersJson) return undefined;
    try {
      const arr = JSON.parse(otherUsersJson);
      if (!Array.isArray(arr)) return undefined;
      const mapped = arr
        .map((u: any) => ({
          userId: String(u?.userId || ""),
          amount: Number(u?.amount || 0),
        }))
        .filter((u: any) => u.userId && Number.isFinite(u.amount) && u.amount >= 0);
      if (!mapped.length) return undefined;
      return userId ? mapped.filter((u) => u.userId !== userId) : mapped;
    } catch {
      return undefined;
    }
  }, [otherUsersJson, userId]);

  const othersSumCents = useMemo(
    () => (parsedOtherUsers ?? []).reduce((s, u) => s + toCents(u.amount), 0),
    [parsedOtherUsers]
  );

  const explicitOrderCents = toCents(parseFloat(orderAmount || "0"));
  const hasExplicitOrder = !!orderAmount && !isNaN(parseFloat(orderAmount));

  const myTargetCents = hasExplicitOrder ? Math.max(0, explicitOrderCents - othersSumCents) : baseCents;

  useEffect(() => {
    console.groupCollapsed("[UAC] Target math (cents)");
    console.table([
      { key: "baseCents", value: baseCents },
      { key: "hasExplicitOrder", value: hasExplicitOrder },
      { key: "explicitOrderCents", value: explicitOrderCents },
      { key: "othersSumCents", value: othersSumCents },
      { key: "myTargetCents", value: myTargetCents },
    ]);
    console.groupEnd();
  }, [baseCents, hasExplicitOrder, explicitOrderCents, othersSumCents, myTargetCents]);

  const recipientParsed = useMemo(() => parseRecipient(), [parseRecipient]);
  useEffect(() => {
    console.groupCollapsed("[UAC] Parsed parties");
    console.log("parsedOtherUsers:", parsedOtherUsers || []);
    console.log("recipient:", recipientParsed || null);
    console.groupEnd();
  }, [parsedOtherUsers, recipientParsed]);

  const isSplitFlow = (parsedOtherUsers?.length ?? 0) > 0;
  const splitComputed = isSplitFlow ? "true" : "false";

  const cardPaymentMethods: PaymentMethod[] = useMemo(
    () => (methodsArray ?? []).filter((m: PaymentMethod) => m.type === "card"),
    [methodsArray]
  );
  const pickPrimaryCard = useCallback(() => {
    return cardPaymentMethods.find((m) => m.card?.primary) || cardPaymentMethods[0] || null;
  }, [cardPaymentMethods]);

  const key = memKey(merchantId, txUpper);
  const draft = __UAC_MEMORY__[key];

  const [instantPowerAmount, setInstantPowerAmount] = useState<string>(draft?.instantPowerAmount ?? "");

  const [superchargeFields, setSuperchargeFields] = useState<SuperchargeField[]>(
    (draft?.superchargeFields && draft.superchargeFields.length > 0
      ? draft.superchargeFields.map((f) => ({
          amount: f.amount ?? "",
          selectedPaymentMethod: null,
          selectedPaymentMethodId: f.selectedPaymentMethodId ?? null,
        }))
      : []) as SuperchargeField[]
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeFieldIndex, setActiveFieldIndex] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (loadingMethods) return;
    if (cardPaymentMethods.length === 0) return;

    setSuperchargeFields((prev) => {
      if (!prev.length) return prev;

      const idMap = new Map(cardPaymentMethods.map((c) => [c.id, c]));
      const next = prev.map((f) => {
        if (f.selectedPaymentMethod) return f;
        const obj = f.selectedPaymentMethodId ? idMap.get(f.selectedPaymentMethodId) ?? null : null;
        return { ...f, selectedPaymentMethod: obj ?? f.selectedPaymentMethod ?? null };
      });

      for (let i = 0; i < next.length; i++) {
        if (!next[i].selectedPaymentMethod) {
          next[i] = { ...next[i], selectedPaymentMethod: pickPrimaryCard() };
        }
      }
      return next;
    });
  }, [loadingMethods, cardPaymentMethods, pickPrimaryCard]);

  useEffect(() => {
    __UAC_MEMORY__[key] = {
      powerMode,
      instantPowerAmount,
      superchargeFields: (superchargeFields || []).map((f) => ({
        amount: f.amount ?? "",
        selectedPaymentMethodId: f.selectedPaymentMethod?.id ?? f.selectedPaymentMethodId ?? null,
      })),
    };
  }, [key, powerMode, instantPowerAmount, superchargeFields]);

  const usedMethodIds = useMemo(() => {
    return getUsedMethodIds(superchargeFields, activeFieldIndex ?? undefined);
  }, [superchargeFields, activeFieldIndex]);

  const canAddMoreSupercharge = useMemo(() => {
    const allUsedIds = getUsedMethodIds(superchargeFields);
    const availableCount = cardPaymentMethods.filter((m) => !allUsedIds.has(m.id)).length;
    return availableCount > 0;
  }, [superchargeFields, cardPaymentMethods]);

  const addField = useCallback(() => {
    setSuperchargeFields((prev) => {
      const currentUsedIds = getUsedMethodIds(prev);
      const availableMethod = cardPaymentMethods.find((m) => !currentUsedIds.has(m.id)) ?? null;

      if (!availableMethod) return prev;

      return [...prev, { amount: "", selectedPaymentMethod: availableMethod }];
    });
  }, [cardPaymentMethods]);

  const updateFieldAmount = (idx: number, val: string) => {
    if (!/^\d*(\.\d{0,2})?$/.test(val)) return;
    setSuperchargeFields((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], amount: val };
      return next;
    });
  };

  const handleMethodSelect = useCallback(
    (method: PaymentMethod) => {
      if (activeFieldIndex != null) {
        setSuperchargeFields((prev) => {
          const next = [...prev];
          next[activeFieldIndex] = { ...next[activeFieldIndex], selectedPaymentMethod: method };
          return next;
        });
      }
      setIsModalOpen(false);
    },
    [activeFieldIndex]
  );

  const resetLocalState = useCallback(() => {
    setInstantPowerAmount("");
    setSuperchargeFields([]);
    setActiveFieldIndex(null);
  }, []);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      resetLocalState();
      const tasks: Promise<any>[] = [];
      if (typeof refetchUser === "function") tasks.push(refetchUser());
      if (typeof refetchMethods === "function") tasks.push(refetchMethods());
      if (!preferParamsBranding && typeof refetchMerchant === "function") {
        tasks.push(refetchMerchant());
      }
      if (tasks.length) await Promise.allSettled(tasks);
    } finally {
      setRefreshing(false);
    }
  }, [refetchUser, refetchMethods, refetchMerchant, resetLocalState, preferParamsBranding]);

  const fieldsWithPositive = superchargeFields.filter((f) => toCents(f.amount) > 0);
  const sumSuperchargeCents = fieldsWithPositive.reduce((acc, f) => acc + toCents(f.amount), 0);
  const enteredInstantCents = isSupercharge || isSelfPay ? 0 : toCents(instantPowerAmount);
  const totalEnteredCents = enteredInstantCents + sumSuperchargeCents;

  // Self-pay remaining calculation (mobile parity)
  const selfPayRemainingCents = isSelfPay ? Math.max(0, myTargetCents - sumSuperchargeCents) : 0;

  const hasEmptyInstant = isSupercharge || isSelfPay ? false : instantPowerAmount.trim() === "";
  const noPositiveSupercharges = fieldsWithPositive.length === 0;
  const hasMissingCard = fieldsWithPositive.some((f) => !f.selectedPaymentMethod?.id);

  // Self-pay validation: supercharge must be less than total (mobile parity)
  const selfPayValid = isSelfPay ? sumSuperchargeCents < myTargetCents && selfPayRemainingCents > 0 : true;

  const exactMatch = isSelfPay ? true : totalEnteredCents === myTargetCents;

  const MIN_PERCENT = 0.1;
  const minRequiredCents = Math.ceil(myTargetCents * MIN_PERCENT);
  const meetsMinContribution = isSupercharge
    ? sumSuperchargeCents >= minRequiredCents
    : isSelfPay
    ? selfPayRemainingCents > 0
    : enteredInstantCents >= minRequiredCents;

  const disabled = isSelfPay
    ? !selfPayValid || (fieldsWithPositive.length > 0 && hasMissingCard)
    : isSupercharge
    ? noPositiveSupercharges || hasMissingCard || !exactMatch || !meetsMinContribution
    : hasEmptyInstant || hasMissingCard || !exactMatch || !meetsMinContribution;

  const addDisabled = !canAddMoreSupercharge;

  useEffect(() => {
    console.groupCollapsed("[UAC] Entry/Validation (cents)");
    console.table([
      { key: "isSupercharge", value: isSupercharge },
      { key: "isSelfPay", value: isSelfPay },
      { key: "instantPowerAmount", value: instantPowerAmount },
      { key: "fieldsWithPositive", value: fieldsWithPositive.length },
      { key: "sumSuperchargeCents", value: sumSuperchargeCents },
      { key: "enteredInstantCents", value: enteredInstantCents },
      { key: "totalEnteredCents", value: totalEnteredCents },
      { key: "selfPayRemainingCents", value: selfPayRemainingCents },
      { key: "selfPayValid", value: selfPayValid },
      { key: "hasMissingCard", value: hasMissingCard },
      { key: "exactMatch", value: exactMatch },
      { key: "minRequiredCents", value: minRequiredCents },
      { key: "meetsMinContribution", value: meetsMinContribution },
      { key: "disabled", value: disabled },
      { key: "addDisabled", value: addDisabled },
      { key: "canAddMoreSupercharge", value: canAddMoreSupercharge },
    ]);
    console.groupEnd();
  }, [
    isSupercharge,
    isSelfPay,
    instantPowerAmount,
    fieldsWithPositive,
    sumSuperchargeCents,
    enteredInstantCents,
    totalEnteredCents,
    selfPayRemainingCents,
    selfPayValid,
    hasMissingCard,
    exactMatch,
    disabled,
    minRequiredCents,
    meetsMinContribution,
    addDisabled,
    canAddMoreSupercharge,
  ]);

  // Navigate to UnifiedPlans (non-SELFPAY) or UnifiedSelfPayPaymentPlan (SELFPAY)
  const goContinue = () => {
    if (!isSelfPay && !meetsMinContribution) {
      toast.info(
        `Please enter at least ${(MIN_PERCENT * 100).toFixed(0)}% ($${centsToMajor(minRequiredCents).toFixed(
          2
        )}) of the total.`
      );
      return;
    }

    if (isSelfPay && selfPayRemainingCents <= 0) {
      toast.info("Supercharge amount cannot equal or exceed the total. Some amount must remain for Self-Pay.");
      return;
    }

    if (isSelfPay && fieldsWithPositive.length > 0 && hasMissingCard) {
      toast.info("Please select a card for each supercharge amount.");
      return;
    }

    if (!isSelfPay && disabled) {
      toast.info("Please complete the amounts and card selections first.");
      return;
    }

    // Build supercharge details with amount as string "10.00" (mobile parity)
    const details = fieldsWithPositive.map((f) => ({
      amount: (toCents(f.amount) / 100).toFixed(2),
      paymentMethodId: f.selectedPaymentMethod!.id,
    }));

    // Compute the amount to forward (mobile parity)
    // - SUPERCHARGE: full target amount
    // - SELFPAY: remaining after supercharge (this is the self-pay amount)
    // - INSTANT/YEARLY: the entered instant amount
    const amountToFlex = isSupercharge
      ? centsToMajor(myTargetCents).toFixed(2)
      : isSelfPay
      ? centsToMajor(selfPayRemainingCents).toFixed(2)
      : (toCents(instantPowerAmount) / 100).toFixed(2);

    // Forward correct branding even when it comes from merchant fallback
    const forwardedDisplayName = displayNameParam || headerName || "";
    const forwardedDisplayLogo = displayLogoParam || (brandLogoFromMerchant ? String(brandLogoFromMerchant) : "") || "";
    const forwardedLogoUri = computedLogoUri || logoUriParam || "";

    const baseParams = new URLSearchParams({
      merchantId,
      amount: amountToFlex, // <- self-pay amount for SELFPAY, instant for INSTANT, full for SUPERCHARGE
      amountParam: amountParamOverride || amountParam, // <- original total amount
      powerMode,

      superchargeDetails: JSON.stringify(details.length ? details : []),
      discountList: discountListCanonical,
      requestId,
      transactionType: transactionTypeRaw,

      otherUsers: otherUsersJson,
      recipient: recipientJson,

      totalAmount,
      orderAmount,
      displayLogo: forwardedDisplayLogo,
      displayName: forwardedDisplayName,

      selfPay: isSelfPay ? "true" : "false",

      split: splitComputed,
      logoUri: forwardedLogoUri,
      paymentPlanId,
      paymentSchemeId,
      splitPaymentId,
    });

    console.groupCollapsed(`[UAC] NAV -> ${isSelfPay ? "/UnifiedSelfPayPaymentPlan" : "/UnifiedPlans"}`);
    console.log("query (raw):", Object.fromEntries(baseParams.entries()));
    console.log("split(computed):", splitComputed);
    console.log("amountToFlex:", amountToFlex);
    console.log("superchargeDetails:", details);
    if (otherUsersJson) {
      try {
        console.log("otherUsers(parsed):", JSON.parse(otherUsersJson));
      } catch {}
    }
    if (recipientJson) {
      try {
        console.log("recipient(parsed):", JSON.parse(recipientJson));
      } catch {}
    }
    console.groupEnd();

    if (isSelfPay) {
      navigate(`/UnifiedSelfPayPaymentPlan?${baseParams.toString()}`);
    } else {
      navigate(`/UnifiedPlans?${baseParams.toString()}`);
    }
  };

  const { mutateAsync: runUnified, isPending: unifiedPending } = useUnifiedCommerce();

  const parseDiscountIds = (): string[] => {
    try {
      const arr = JSON.parse(discountListCanonical);
      return Array.isArray(arr) ? arr.map(String) : [];
    } catch {
      return [];
    }
  };

  const sendByType = async (type: AllowedTransactionType, payload: any) => {
    const start = Date.now();
    try {
      try {
        console.groupCollapsed(`[UAC -> ${type}] OUTGOING payload`);
        console.log(JSON.parse(JSON.stringify(payload)));
        console.groupEnd();
      } catch {
        console.log(`[UAC -> ${type}] OUTGOING payload (stringify failed)`, payload);
      }
      const res = await runUnified(payload);
      try {
        console.log(`[UAC -> ${type}] SUCCESS in ${Date.now() - start}ms`, res);
      } catch {}
      return res;
    } catch (err: any) {
      try {
        console.log(`[UAC -> ${type}] ERROR in ${Date.now() - start}ms`, {
          message: err?.message ?? String(err),
          stack: err?.stack,
        });
      } catch {}
      throw err;
    }
  };

  const runSupercharge = useCallback(async () => {
    const transactionType = (txUpper || "") as AllowedTransactionType | "";

    if (!transactionType) {
      toast.info("Missing transactionType param.");
      return;
    }
    if (!meetsMinContribution) {
      toast.info(
        `Please allocate at least ${(MIN_PERCENT * 100).toFixed(0)}% ($${centsToMajor(minRequiredCents).toFixed(
          2
        )}) of the total.`
      );
      return;
    }
    if (disabled) {
      toast.info(
        "Please fill supercharge amounts (for those you use), select a card for each positive amount, and ensure totals equal the amount."
      );
      return;
    }

    const details = fieldsWithPositive.map((f) => ({
      amount: Number((toCents(f.amount) / 100).toFixed(2)),
      paymentMethodId: f.selectedPaymentMethod!.id,
    }));

    const today = new Date().toISOString().split("T")[0];
    const discountIds = parseDiscountIds();
    const hasDiscounts = discountIds.length > 0;

    const common: any = {
      paymentFrequency: "MONTHLY",
      numberOfPayments: 1,
      offsetStartDate: today,
      instantAmount: 0,
      yearlyAmount: 0,
      superchargeDetails: details,
      selfPayActive: false,
      totalPlanAmount: centsToMajor(myTargetCents),
      interestFreeUsed: 0,
      interestRate: 0,
      apr: 0,
      schemeAmount: centsToMajor(myTargetCents),
      otherUsers: parsedOtherUsers,
      ...(hasDiscounts ? { discountIds } : {}),
    };

    try {
      console.groupCollapsed("[UAC] SUPERCHARGE -> common parties snapshot");
      console.log("otherUsers (actual):", common.otherUsers || []);
      console.log("recipient (actual):", recipientParsed || null);
      console.log("split(computed):", splitComputed);
      console.groupEnd();
    } catch {}

    try {
      switch (transactionType) {
        case "CHECKOUT": {
          const sessionCheckoutToken = getSession("checkoutToken");
          console.log("[UAC] Using checkoutToken from session:", sessionCheckoutToken);

          const req = buildCheckoutRequest(
            {
              checkoutMerchantId: merchantId,
              checkoutType: "ONLINE",
              checkoutRedirectUrl: null,
              checkoutReference: null,
              checkoutDetails: null,
              checkoutToken: sessionCheckoutToken,
            },
            common
          );
          await sendByType("CHECKOUT", req);
          navigate(
            `/SuccessPayment?amount=${encodeURIComponent(centsToMajor(myTargetCents).toFixed(2))}&split=${splitComputed}&replace_to_index=1`
          );
          break;
        }
        case "PAYMENT": {
          const req = buildPaymentRequest(
            { merchantId, paymentTotalAmount: { amount: centsToMajor(myTargetCents), currency: "USD" } },
            common
          );
          await sendByType("PAYMENT", req);
          navigate(
            `/SuccessPayment?amount=${encodeURIComponent(centsToMajor(myTargetCents).toFixed(2))}&split=${splitComputed}&replace_to_index=1`
          );
          break;
        }
        case "SEND": {
          const recipient = recipientParsed;
          if (!recipient) {
            toast.info("Provide a valid single recipient JSON.");
            return;
          }
          const req = buildSendRequest(recipient, { note: "Transfer" }, common);
          await sendByType("SEND", req);
          navigate(
            `/SuccessPayment?amount=${encodeURIComponent(Number(recipient.amount).toFixed(2))}&split=${splitComputed}&replace_to_index=1`
          );
          break;
        }
        case "ACCEPT_REQUEST": {
          if (!requestId) {
            toast.info("Missing requestId for ACCEPT_REQUEST.");
            return;
          }
          const req = buildAcceptRequest(requestId, common);
          await sendByType("ACCEPT_REQUEST", req);
          navigate(
            `/SuccessPayment?amount=${encodeURIComponent(centsToMajor(myTargetCents).toFixed(2))}&split=${splitComputed}&replace_to_index=1`
          );
          break;
        }
        case "ACCEPT_SPLIT_REQUEST": {
          if (!requestId) {
            toast.info("Missing requestId for ACCEPT_SPLIT_REQUEST.");
            return;
          }
          const req = buildAcceptSplitRequest(requestId, common);
          await sendByType("ACCEPT_SPLIT_REQUEST", req);
          navigate(
            `/SuccessPayment?amount=${encodeURIComponent(centsToMajor(myTargetCents).toFixed(2))}&split=${splitComputed}&replace_to_index=1`
          );
          break;
        }
        case "VIRTUAL_CARD": {
          const firstMethodId = fieldsWithPositive[0]?.selectedPaymentMethod?.id;
          if (!firstMethodId) {
            toast.info("Select a card for supercharge.");
            return;
          }
          const vcOptions: VirtualCardOptions = {};
          const vcCommon = { ...common, selectedPaymentMethod: firstMethodId };
          const req = buildVirtualCardRequestWithOptions(merchantId, vcOptions, vcCommon);
          await sendByType("VIRTUAL_CARD", req);

          const preferredLogo =
            logoUriParam ||
            (typeof merchantRes?.data?.brand?.displayLogo === "string"
              ? resolveLogoUrl(merchantRes?.data?.brand?.displayLogo)
              : "") ||
            "";
          navigate(`/card-details?storeLogo=${encodeURIComponent(preferredLogo)}`);
          break;
        }
        case "SOTERIA_PAYMENT": {
          if (!paymentPlanId || !paymentSchemeId || !splitPaymentId) {
            toast.info(
              !paymentPlanId
                ? "paymentPlanId is required for SOTERIA_PAYMENT."
                : !paymentSchemeId
                ? "paymentSchemeId is required for SOTERIA_PAYMENT."
                : "splitPaymentId is required for SOTERIA_PAYMENT."
            );
            return;
          }

          const soteriaPayload: Record<string, any> = {
            paymentPlanId,
            paymentSchemeId,
            splitPaymentId,
            displayLogo: displayLogoParam || undefined,
            displayName: displayNameParam || undefined,
            split: splitComputed,
            logoUri: logoUriParam || undefined,
          };

          const req = buildSoteriaPaymentRequest(
            {
              merchantId,
              soteriaPaymentTotalAmount: { amount: centsToMajor(myTargetCents), currency: "USD" },
              paymentTotalAmount: { amount: centsToMajor(myTargetCents), currency: "USD" },
              soteriaPayload,
              paymentPlanId,
              paymentSchemeId,
              splitPaymentId,
            },
            common
          );

          await sendByType("SOTERIA_PAYMENT", req);
          navigate(
            `/SuccessPayment?amount=${encodeURIComponent(centsToMajor(myTargetCents).toFixed(2))}&split=${splitComputed}&replace_to_index=1`
          );
          break;
        }
      }
    } catch (e: any) {
      console.error("[UAC] runSupercharge ERROR", e?.message || e);
      toast.error(e?.message || "Something went wrong. Please try again.");
    }
  }, [
    txUpper,
    disabled,
    fieldsWithPositive,
    myTargetCents,
    parsedOtherUsers,
    requestId,
    merchantId,
    runUnified,
    navigate,
    logoUriParam,
    merchantRes,
    paymentPlanId,
    paymentSchemeId,
    splitPaymentId,
    displayLogoParam,
    displayNameParam,
    discountListCanonical,
    recipientParsed,
    meetsMinContribution,
    minRequiredCents,
    splitComputed,
  ]);

  if ((!preferParamsBranding && loadingMerchant) || loadingUser || loadingMethods) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <span>Loading...</span>
      </div>
    );
  }

  const errorMsg = (merchantError as any)?.message || (methodsError as any)?.message || "";

  return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center p-4">
        <button onClick={() => navigate(-1)} className="flex items-center text-gray-700 hover:text-gray-900">
          <IoIosArrowBack className="mr-2" size={24} />
          Back
        </button>
      </header>

      <div className="px-6">
        {computedLogoUri && (
          <div className="flex items-center justify-center mb-4">
            <img
              src={computedLogoUri}
              alt={headerName || "brand"}
              className="w-24 h-24 rounded-full border border-gray-300 object-cover"
              onError={(e) => {
                console.warn("[UAC] Logo failed to load:", computedLogoUri);
                (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
              }}
              onLoad={() => console.log("[UAC] Logo loaded:", computedLogoUri)}
            />
          </div>
        )}

        {errorMsg ? <div className="text-center text-red-600 mb-3">{errorMsg}</div> : null}

        <h1 className="text-xl font-bold mb-4">
          {headerName
            ? `Customize Your $${centsToMajor(myTargetCents).toFixed(2)} for ${headerName}`
            : `Customize Your $${centsToMajor(myTargetCents).toFixed(2)}`}
        </h1>

        {/* Instant (or Yearly) input – hidden for SUPERCHARGE and SELFPAY */}
        {!isSupercharge && !isSelfPay && (
          <FloatingLabelInputWithInstant
            key={`instant-${key}`}
            label={powerMode === "YEARLY" ? "Yearly Power Amount" : "Instant Power Amount"}
            value={instantPowerAmount}
            onChangeText={(v: string) => {
              if (/^\d*(\.\d{0,2})?$/.test(v) || v === "") setInstantPowerAmount(v);
            }}
            instantPower={instantaneousPower}
            powerType={powerMode === "YEARLY" ? "yearly" : "instantaneous"}
          />
        )}

        {/* Self-Pay info container (mobile parity) */}
        {isSelfPay && (
          <div className="bg-gray-100 p-4 rounded-xl mb-4">
            <p className="text-lg font-semibold text-black">
              Self-Pay Amount: ${centsToMajor(selfPayRemainingCents).toFixed(2)}
            </p>
            {sumSuperchargeCents > 0 && (
              <p className="text-sm text-gray-600">
                Supercharge: ${centsToMajor(sumSuperchargeCents).toFixed(2)} • Total: $
                {centsToMajor(myTargetCents).toFixed(2)}
              </p>
            )}
            {sumSuperchargeCents === 0 && (
              <p className="text-sm text-gray-600">
                Add supercharge below to pay part upfront, or continue with full Self-Pay.
              </p>
            )}
          </div>
        )}

        {/* Supercharge fields */}
        {superchargeFields.map((f, i) => (
          <div key={`sc-${key}-${i}`} className="mt-4">
            <FloatingLabelInputOverdraft
              label={`Supercharge #${i + 1}`}
              value={f.amount}
              onChangeText={(v) => updateFieldAmount(i, v)}
              selectedMethod={f.selectedPaymentMethod}
              onPaymentMethodPress={() => {
                setSuperchargeFields((prev) => {
                  const next = [...prev];
                  if (!next[i]?.selectedPaymentMethod) {
                    next[i] = { ...next[i], selectedPaymentMethod: pickPrimaryCard() };
                  }
                  return next;
                });
                setActiveFieldIndex(i);
                setIsModalOpen(true);
              }}
            />
          </div>
        ))}

        {/* CTA row */}
        <div className="mt-6">
          <div className="flex items-center gap-3">
            <button
              onClick={addField}
              type="button"
              disabled={addDisabled}
              className={`flex-1 px-4 py-3 rounded-lg font-bold bg-white text-black border border-[#ccc] ${
                addDisabled ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              Add Supercharge
            </button>

            {!isSupercharge ? (
              <button
                disabled={disabled}
                onClick={goContinue}
                className={`flex-1 py-3 font-semibold rounded-lg ${
                  disabled ? "bg-gray-300 text-gray-600 cursor-not-allowed" : "bg-black text-white hover:bg-gray-900"
                }`}
              >
                Continue
              </button>
            ) : (
              <button
                disabled={disabled || unifiedPending}
                onClick={runSupercharge}
                className={`flex-1 py-3 font-semibold rounded-lg ${
                  disabled || unifiedPending
                    ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                    : "bg-black text-white hover:bg-gray-900"
                }`}
              >
                {unifiedPending ? "Processing..." : txUpper === "VIRTUAL_CARD" ? "Pay & Issue Card" : "Pay & Finish"}
              </button>
            )}
          </div>

          {addDisabled && <p className="text-xs text-gray-500 mt-2">All payment methods are already in use.</p>}

          {!meetsMinContribution && !addDisabled && !isSelfPay && (
            <p className="text-xs text-gray-500 mt-2">
              Minimum required: ${centsToMajor(minRequiredCents).toFixed(2)} (10% of total)
            </p>
          )}

          {isSelfPay && sumSuperchargeCents >= myTargetCents && (
            <p className="text-xs text-red-600 mt-2">
              Supercharge amount must be less than total. Remaining Self-Pay amount must be greater than $0.
            </p>
          )}
        </div>
      </div>

      {/* Card Picker Modal */}
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
              transition={{ duration: 0.2 }}
            >
              <div className="w-full sm:max-w-md bg-white rounded-t-lg sm:rounded-lg shadow-lg max-h-[75vh] overflow-y-auto p-4">
                {(cardPaymentMethods ?? []).length === 0 && (
                  <p className="text-center text-gray-600">No payment methods available.</p>
                )}

                {(cardPaymentMethods ?? []).map((m: PaymentMethod) => (
                  <PaymentMethodItem
                    key={m.id}
                    method={m}
                    selectedMethod={
                      activeFieldIndex != null ? superchargeFields[activeFieldIndex]?.selectedPaymentMethod ?? null : null
                    }
                    onSelect={handleMethodSelect}
                    disabled={usedMethodIds.has(m.id)}
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

export default UnifiedAmountCustomization;