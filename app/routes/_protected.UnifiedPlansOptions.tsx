// src/routes/UnifiedPlansOptions.tsx
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { HiOutlineLightningBolt, HiOutlineCalendar } from "react-icons/hi";
import { FaCreditCard } from "react-icons/fa";
import { IoIosArrowBack } from "react-icons/io";
import { useLocation, useNavigate, useSearchParams } from "@remix-run/react";
import ProtectedRoute from "~/compoments/ProtectedRoute";
import { useUserDetails } from "~/hooks/useUserDetails";
import { useMerchantDetail } from "~/hooks/useMerchantDetail";
import { useCheckoutDetail } from "~/hooks/useCheckoutDetail";
import { toast, Toaster } from "sonner";

/** ---------------- Small helpers (non-logic) ---------------- */
const mask = (s?: string | null) => {
  if (!s) return "";
  if (s.length <= 8) return "****";
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
};
const safeNum = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/** ---------------- Env + URL helpers ---------------- */
const isBrowser = typeof window !== "undefined";

function resolveBaseUrl(): string {
  let fromEnv: string | undefined;

  // 1) Node-style env vars (Remix/server)
  if (typeof process !== "undefined" && (process as any).env) {
    const env = (process as any).env;
    fromEnv =
      (env.REACT_APP_API_HOST as string | undefined) ||
      (env.API_HOST as string | undefined) ||
      (env.REACT_APP_BASE_URL as string | undefined) ||
      (env.BASE_URL as string | undefined) ||
      (env.CUSTOM_API_BASE_URL as string | undefined);
  }

  if (fromEnv && typeof fromEnv === "string" && fromEnv.trim().length > 0) {
    return fromEnv.trim().replace(/\/+$/, "");
  }

  // 2) If in the browser, derive from current hostname + :8080
  if (isBrowser) {
    try {
      const loc = window.location;
      const protocol = loc.protocol === "https:" ? "https:" : "http:";
      const host = loc.hostname;
      const port = "8080"; // backend port
      const built = `${protocol}//${host}:${port}`;
      return built;
    } catch {
      // ignore and fall through
    }
  }

  // 3) Final fallback
  return "http://localhost:8080";
}

const BASE_URL = resolveBaseUrl();

const isAbsoluteUrl = (u?: string | null) => !!u && /^https?:\/\//i.test(u);
const isDicebearUrl = (u?: string | null) =>
  !!u && /(^https?:\/\/)?([^/]*\.)?api\.dicebear\.com/i.test(u);

function resolveLogoUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (isAbsoluteUrl(path) || isDicebearUrl(path)) return path;
  const base = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

/** Remove "null"/"undefined" and stray quotes from params. */
const sanitizeParamString = (raw?: string) => {
  const s = (raw ?? "").trim();
  if (!s) return "";
  const low = s.toLowerCase();
  if (low === "null" || low === "undefined") return "";
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
};

/** Normalize value (string[] | string | undefined) to a single sanitized string. */
const normalizeParam = (v: string | string[] | undefined, fallback = ""): string =>
  sanitizeParamString(Array.isArray(v) ? v[0] : v ?? fallback);

/** Canonicalize a discount list into JSON array of unique IDs (as strings). */
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

// Truncate (not round) to two decimal places, then format with exactly 2
function formatNoRound(value: number): string {
  const truncated = Math.trunc(value * 100) / 100;
  return truncated.toFixed(2);
}

/** ---------------- Types (for navigation payloads) ---------------- */
type PowerMode = "INSTANT" | "YEARLY" | "SUPERCHARGE" | "SELFPAY";
export interface SplitEntry {
  userId: string;
  amount: string;
}
export interface SplitData {
  userAmounts: SplitEntry[];
}
export interface User {
  id: string;
  username: string;
  logo: string;
  isCurrentUser?: boolean;
}

/** ======================== Component ======================== */
const UnifiedPlansOptions: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // ------------------ BEGIN: UNCONDITIONAL HOOKS BLOCK ------------------
  const { data: userDetailsData, isLoading: userLoading, isError: userError } = useUserDetails();

  const checkoutToken = typeof window !== "undefined" ? sessionStorage.getItem("checkoutToken") || "" : "";
  const { data: checkoutData, isLoading: checkoutLoading, error: checkoutError } = useCheckoutDetail(checkoutToken);

  const merchantBaseId = checkoutData?.merchantBaseId ?? checkoutData?.merchantId ?? "";

  const { data: merchantRes, isLoading: merchantLoading, error: merchantError } = useMerchantDetail(merchantBaseId);

  const [splitData, setSplitData] = useState<SplitData | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedDiscounts, setSelectedDiscounts] = useState<string[]>([]);
  // ------------------ END:   UNCONDITIONAL HOOKS BLOCK ------------------

  // ---- LOG: raw search params
  useEffect(() => {
    console.groupCollapsed("[UnifiedPlansOptions] URL Search Params (raw)");
    try {
      const entries = Array.from(searchParams.entries());
      console.table(entries.map(([k, v]) => ({ key: k, value: v })));
    } finally {
      console.groupEnd();
    }
  }, [searchParams]);

  // Pull optional state (from previous page)
  useEffect(() => {
    const stateData =
      ((location.state as { splitData?: SplitData; users?: User[]; selectedDiscounts?: string[] } | undefined) || {}) ??
      {};
    if (stateData.splitData) setSplitData(stateData.splitData);
    setUsers(stateData.users || []);
    if (stateData.selectedDiscounts) setSelectedDiscounts(stateData.selectedDiscounts);

    console.groupCollapsed("[UnifiedPlansOptions] navigation.state");
    console.log("stateData:", stateData);
    console.groupEnd();
  }, [location.state]);

  // ------------- URL param context -------------
  const requestId = normalizeParam(searchParams.get("requestId") ?? undefined, "");

  const amountParam = normalizeParam(searchParams.get("amount") ?? undefined, "");
  const orderAmountRaw = normalizeParam(searchParams.get("orderAmount") ?? undefined, "");
  const totalAmount = normalizeParam(searchParams.get("totalAmount") ?? undefined, "");
  const discountListRaw = normalizeParam(searchParams.get("discountList") ?? undefined, "[]");
  const displayLogoParam = normalizeParam(searchParams.get("displayLogo") ?? undefined, "");
  const displayNameParam = normalizeParam(searchParams.get("displayName") ?? undefined, "");
  const logoUriParam = normalizeParam(searchParams.get("logoUri") ?? undefined, "");
  const transactionTypeRaw = normalizeParam(searchParams.get("transactionType") ?? undefined, "");
  const splitParam = normalizeParam(searchParams.get("split") ?? undefined, "");
  const otherUsersRaw = normalizeParam(searchParams.get("otherUsers") ?? undefined, "");
  const recipientRaw = normalizeParam(searchParams.get("recipient") ?? undefined, "");
  const superchargeDetailsRaw = normalizeParam(searchParams.get("superchargeDetails") ?? undefined, "[]");
  const paymentPlanId = normalizeParam(searchParams.get("paymentPlanId") ?? undefined, "");
  const paymentSchemeId = normalizeParam(searchParams.get("paymentSchemeId") ?? undefined, "");
  const splitPaymentId = normalizeParam(searchParams.get("splitPaymentId") ?? undefined, "");

  // Optional hint param (web-only): if provided, can mimic RN’s splitSummary “type”
  const splitTypeParam = normalizeParam(searchParams.get("splitType") ?? undefined, "");

  // ---- LOG: normalized URL params
  useEffect(() => {
    console.groupCollapsed("[UnifiedPlansOptions] URL Params (normalized)");
    console.table([
      { key: "amount", value: amountParam },
      { key: "orderAmount", value: orderAmountRaw },
      { key: "totalAmount", value: totalAmount },
      { key: "discountList", value: discountListRaw },
      { key: "displayLogo", value: displayLogoParam },
      { key: "displayName", value: displayNameParam },
      { key: "logoUri", value: logoUriParam },
      { key: "transactionType", value: transactionTypeRaw },
      { key: "split", value: splitParam },
      { key: "requestId", value: requestId },
      { key: "otherUsers", value: otherUsersRaw },
      { key: "recipient", value: recipientRaw },
      { key: "superchargeDetails", value: superchargeDetailsRaw },
      { key: "paymentPlanId", value: paymentPlanId },
      { key: "paymentSchemeId", value: paymentSchemeId },
      { key: "splitPaymentId", value: splitPaymentId },
      { key: "splitType", value: splitTypeParam },
    ]);
    console.groupEnd();
  }, [
    amountParam,
    orderAmountRaw,
    totalAmount,
    discountListRaw,
    displayLogoParam,
    displayNameParam,
    logoUriParam,
    transactionTypeRaw,
    splitParam,
    requestId,
    otherUsersRaw,
    recipientRaw,
    superchargeDetailsRaw,
    paymentPlanId,
    paymentSchemeId,
    splitPaymentId,
    splitTypeParam,
  ]);

  // ---- Derived params
  const discountList = useMemo(() => canonicalizeDiscountList(discountListRaw), [discountListRaw]);

  // Split flow detection (otherUsers JSON)
  const isSplitFlow = useMemo(() => {
    if (!otherUsersRaw) return false;
    try {
      const parsed = JSON.parse(otherUsersRaw);
      return Array.isArray(parsed) && parsed.filter((x) => x && x.userId).length > 0;
    } catch {
      return false;
    }
  }, [otherUsersRaw]);

  const orderAmount = useMemo(() => {
    return (
      orderAmountRaw ||
      (amountParam ? String(Number.isFinite(parseFloat(amountParam)) ? parseFloat(amountParam) : 0) : "")
    );
  }, [orderAmountRaw, amountParam]);

  // eligibility amount (STRICTLY amountParam)
  const effectiveAmount = useMemo(() => {
    const n = parseFloat((amountParam || "0").toString().replace(/[$,\s]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }, [amountParam]);

  // ---------- Derived data from queries ----------
  const instantaneousPower = userDetailsData?.data?.user?.instantaneousPower ?? 0;
  const yearlyPower = userDetailsData?.data?.user?.yearlyPower ?? 0;
  const subscribed = userDetailsData?.data?.subscribed ?? true;

  // ---- determine type flags
  const upperType = (transactionTypeRaw || "").toUpperCase().trim();
  const isSend = upperType === "SEND";
  const isAccept = upperType === "ACCEPT_REQUEST";
  const isSoteria = upperType === "SOTERIA_PAYMENT";
  const isAcceptSplit = upperType === "ACCEPT_SPLIT_REQUEST";
  const isVirtualCardTx = upperType === "VIRTUAL_CARD";
  const isCardTx = upperType === "CARD";

  // Mobile parity (without split summary hook):
  // If backend passes splitType=card (or split=card), treat as card-split.
  const splitTypeLower = (splitTypeParam || splitParam || "").toString().toLowerCase();
  const isCardSplit = isAcceptSplit && splitTypeLower === "card";

  // ---- merchant config
  const hasMerchantData = !!merchantRes?.data;
  const cfg = merchantRes?.data?.configuration;

  // Fallback: if we're accepting a split and merchant data is missing, assume Self-Pay is allowed & unbounded
  const fallbackSelfPayEnabled = isAcceptSplit && !hasMerchantData;

  const selfPayEnabled = (!!cfg?.enableSelfPay && hasMerchantData) || fallbackSelfPayEnabled;

  // Top-level bounds
  const topMinRaw = hasMerchantData ? cfg?.minAmount?.amount : undefined;
  const topMaxRaw = hasMerchantData ? cfg?.maxAmount?.amount : undefined;
  const parsedTopMin = topMinRaw != null ? parseFloat(topMinRaw) : undefined;
  const parsedTopMax = topMaxRaw != null ? parseFloat(topMaxRaw) : undefined;
  const minAmount = parsedTopMin && parsedTopMin > 0 ? parsedTopMin : undefined;
  const maxAmount = parsedTopMax && parsedTopMax > 0 ? parsedTopMax : undefined;

  const withinMin = minAmount == null || effectiveAmount >= minAmount;
  const withinMax = maxAmount == null || effectiveAmount <= maxAmount;

  type AnyTier = { termType?: string; minTerm?: number; maxTerm?: number; minAmount?: string; maxAmount?: string };
  const tiers: AnyTier[] =
    hasMerchantData && Array.isArray(cfg?.selfPayTiers) ? (cfg!.selfPayTiers as AnyTier[]) : [];

  const fitsAnyTier = useMemo(() => {
    if (!tiers.length) return true;
    return tiers.some((t) => {
      const tMin = t.minAmount != null ? parseFloat(t.minAmount) : 0;
      const tMax = t.maxAmount != null ? parseFloat(t.maxAmount) : Number.POSITIVE_INFINITY;
      return effectiveAmount >= tMin && effectiveAmount <= tMax;
    });
  }, [tiers, effectiveAmount]);

  // final eligibility — STRICTLY from amountParam (fallback path requires > 0)
  const selfPayAmountEligible =
    selfPayEnabled && (fallbackSelfPayEnabled ? effectiveAmount > 0 : withinMin && withinMax && fitsAnyTier);

  // visibility — mobile parity
  const hideSelfPayBase = isVirtualCardTx || isSoteria;
  const hideSelfPay = hideSelfPayBase || isCardSplit;

  const showSelfPayCard = !hideSelfPay && !(isSend || isAccept) && (selfPayEnabled || isAcceptSplit);

  // Branding
  const brandFromMerchant = merchantRes?.data?.brand ?? null;
  const fallbackBrand = brandFromMerchant ?? checkoutData?.brand ?? null;
  const paramLogo = displayLogoParam ? resolveLogoUrl(displayLogoParam) : undefined;
  const brandLogo = resolveLogoUrl(fallbackBrand?.displayLogo);
  const computedLogoUri = logoUriParam || paramLogo || brandLogo;
  const computedDisplayName = displayNameParam || fallbackBrand?.displayName || "";

  // ---- loading / errors
  useEffect(() => {
    if (userError) toast.error("Error loading user details.");
  }, [userError]);
  useEffect(() => {
    if (checkoutError) toast.error("Error loading checkout details.");
  }, [checkoutError]);
  useEffect(() => {
    if (merchantError) toast.error("Error loading merchant details.");
  }, [merchantError]);

  // ------- LOG: fetched data snapshots & derived flags -------
  useEffect(() => {
    console.groupCollapsed("[UnifiedPlansOptions] Data: userDetails");
    console.log("isLoading:", userLoading, "isError:", userError);
    console.log("instantaneousPower:", safeNum(instantaneousPower));
    console.log("yearlyPower:", safeNum(yearlyPower));
    console.log("subscribed:", subscribed);
    console.log("raw userDetailsData:", userDetailsData);
    console.groupEnd();
  }, [userLoading, userError, userDetailsData, instantaneousPower, yearlyPower, subscribed]);

  useEffect(() => {
    console.groupCollapsed("[UnifiedPlansOptions] Data: checkout");
    console.log("checkoutToken(masked):", mask(checkoutToken));
    console.log("isLoading:", checkoutLoading, "error:", checkoutError);
    console.log("merchantBaseId:", merchantBaseId);
    console.log("raw checkoutData:", checkoutData);
    console.groupEnd();
  }, [checkoutToken, checkoutLoading, checkoutError, checkoutData, merchantBaseId]);

  useEffect(() => {
    console.groupCollapsed("[UnifiedPlansOptions] Data: merchant");
    console.log("merchantId:", merchantBaseId);
    console.log("isLoading:", merchantLoading, "error:", merchantError);
    console.log("hasMerchantData:", hasMerchantData);
    console.log("configuration summary:", {
      enableSelfPay: cfg?.enableSelfPay,
      minAmount: cfg?.minAmount?.amount,
      maxAmount: cfg?.maxAmount?.amount,
      tiersCount: Array.isArray(cfg?.selfPayTiers) ? cfg?.selfPayTiers.length : 0,
    });
    console.log("raw merchantRes:", merchantRes);
    console.groupEnd();
  }, [merchantBaseId, merchantRes, merchantLoading, merchantError, hasMerchantData, cfg]);

  useEffect(() => {
    console.groupCollapsed("[UnifiedPlansOptions] Derived/Eligibility]");
    console.table([
      { key: "effectiveAmount", value: effectiveAmount },
      { key: "minAmount", value: minAmount ?? "(none)" },
      { key: "maxAmount", value: maxAmount ?? "(none)" },
      { key: "withinMin", value: withinMin },
      { key: "withinMax", value: withinMax },
      { key: "tiers.length", value: tiers.length },
      { key: "fitsAnyTier", value: fitsAnyTier },
      { key: "fallbackSelfPayEnabled", value: fallbackSelfPayEnabled },
      { key: "selfPayEnabled", value: selfPayEnabled },
      { key: "selfPayAmountEligible", value: selfPayAmountEligible },
      { key: "showSelfPayCard", value: showSelfPayCard },
      { key: "isSplitFlow (otherUsers)", value: isSplitFlow },
      { key: "isCardSplit (param)", value: isCardSplit },
      { key: "flags", value: { isSend, isAccept, isSoteria, isAcceptSplit, isVirtualCardTx, isCardTx } },
    ]);
    console.groupEnd();
  }, [
    effectiveAmount,
    minAmount,
    maxAmount,
    withinMin,
    withinMax,
    tiers,
    fitsAnyTier,
    fallbackSelfPayEnabled,
    selfPayEnabled,
    selfPayAmountEligible,
    showSelfPayCard,
    isSplitFlow,
    isCardSplit,
    isSend,
    isAccept,
    isSoteria,
    isAcceptSplit,
    isVirtualCardTx,
    isCardTx,
  ]);

  // ------- handlers / forward payload -------
  const forwardAll = useMemo(
    () => ({
      merchantId: merchantBaseId,
      // If it's a split flow, forward ONLY the user's share (amountParam)
      amount: isSplitFlow ? amountParam : orderAmount || amountParam,
      amountParam, // keep original amountParam available downstream (mobile parity)
      totalAmount,
      orderAmount,
      discountList,
      transactionType: transactionTypeRaw,
      displayLogo: displayLogoParam,
      displayName: displayNameParam,
      split: splitParam,
      logoUri: computedLogoUri ?? "",
      requestId,
      otherUsers: otherUsersRaw,
      recipient: recipientRaw,
      superchargeDetails: superchargeDetailsRaw,
      paymentPlanId,
      paymentSchemeId,
      splitPaymentId,
    }),
    [
      merchantBaseId,
      isSplitFlow,
      amountParam,
      orderAmount,
      totalAmount,
      discountList,
      transactionTypeRaw,
      displayLogoParam,
      displayNameParam,
      splitParam,
      computedLogoUri,
      requestId,
      otherUsersRaw,
      recipientRaw,
      superchargeDetailsRaw,
      paymentPlanId,
      paymentSchemeId,
      splitPaymentId,
    ]
  );

  useEffect(() => {
    console.groupCollapsed("[UnifiedPlansOptions] forwardAll payload");
    console.log(forwardAll);
    console.groupEnd();
  }, [forwardAll]);

  // Mobile parity: all options go through UnifiedAmountCustomization
  const goAmountCustomization = useCallback(
    (picked: PowerMode) => {
      const params = new URLSearchParams({
        ...Object.entries(forwardAll).reduce<Record<string, string>>((acc, [k, v]) => {
          if (v != null && v !== "") acc[k] = String(v);
          return acc;
        }, {}),
        powerMode: picked,
        selfPay: picked === "SELFPAY" ? "true" : "false",
      });

      console.groupCollapsed("[UnifiedPlansOptions] NAV → /UnifiedAmountCustomization");
      console.log("picked:", picked);
      console.log("query:", Object.fromEntries(params.entries()));
      console.groupEnd();

      navigate(`/UnifiedAmountCustomization?${params.toString()}`);
    },
    [forwardAll, navigate]
  );

  // SelfPay click (mobile parity): SELFPAY mode, selfPay=true, and force amount=amountParam
  const handleSelfPayClick = useCallback(() => {
    if (!selfPayAmountEligible) {
      console.warn("[UnifiedPlansOptions] SelfPay click ignored: not eligible");
      return;
    }

    const params = new URLSearchParams({
      ...Object.entries(forwardAll).reduce<Record<string, string>>((acc, [k, v]) => {
        if (v != null && v !== "") acc[k] = String(v);
        return acc;
      }, {}),
      amount: amountParam,
      amountParam,
      powerMode: "SELFPAY",
      selfPay: "true",
    });

    console.groupCollapsed("[UnifiedPlansOptions] NAV → /UnifiedAmountCustomization (SELFPAY)");
    console.log("query:", Object.fromEntries(params.entries()));
    console.groupEnd();

    navigate(`/UnifiedAmountCustomization?${params.toString()}`);
  }, [forwardAll, selfPayAmountEligible, amountParam, navigate]);

  // ---------------- Early returns come AFTER all hooks ----------------
  const showSpinner = userLoading || checkoutLoading || (merchantBaseId && merchantLoading);

  useEffect(() => {
    console.groupCollapsed("[UnifiedPlansOptions] Render gates");
    console.log("showSpinner:", showSpinner);
    console.log("merchantBaseId:", merchantBaseId);
    const merchantDataOk = !merchantBaseId || (!!merchantRes?.data && !merchantError) || isAcceptSplit;
    console.log("merchantDataOk:", merchantDataOk);
    console.groupEnd();
  }, [showSpinner, merchantBaseId, merchantRes, merchantError, isAcceptSplit]);

  if (showSpinner) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="text-gray-700">Loading…</div>
          <Toaster richColors position="top-right" />
        </div>
      </ProtectedRoute>
    );
  }

  // do NOT block screen if merchant fetch failed but we're in ACCEPT_SPLIT_REQUEST
  const merchantDataOk = !merchantBaseId || (!!merchantRes?.data && !merchantError) || isAcceptSplit;

  if (!userDetailsData?.data || !merchantDataOk) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="text-red-600">Error loading data.</div>
          <Toaster richColors position="top-right" />
        </div>
      </ProtectedRoute>
    );
  }

  // ---------------- Render ----------------
  const hideSuperchargeBase = isSend || isAccept || isSoteria;
  const hideSuperchargeForVirtualOrCardTx = isVirtualCardTx || isCardTx;
  const hideSupercharge = hideSuperchargeBase || hideSuperchargeForVirtualOrCardTx || isCardSplit;

  const showInstant = instantaneousPower > 0;
  const showYearly = !(isSend || isAccept) && subscribed && yearlyPower > 0;
  const showSupercharge = !hideSupercharge && subscribed;
  const showSelfPayVisible = showSelfPayCard;
  const noVisibleOptions = !showInstant && !showYearly && !showSelfPayVisible && !showSupercharge;

  return (
    <ProtectedRoute>
      <div className="min-h-screen flex flex-col bg-white p-3 sm:p-4 pt-12 sm:pt-16 lg:pt-20">
        <header className="w-full max-w-3xl mb-6 sm:mb-8">
          <div className="-mt-8 sm:-mt-10 lg:-mt-8">
            <button
              onClick={() => {
                console.log("[UnifiedPlansOptions] Back clicked");
                navigate(-1);
              }}
              className="flex items-center text-gray-700 hover:text-gray-900 mb-8"
              aria-label="Go back"
            >
              <IoIosArrowBack className="mr-2" size={22} />
              <span className="text-base sm:text-lg">Back</span>
            </button>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-left break-words">
            {computedDisplayName ? `Choose a power option for ${computedDisplayName}` : "Choose a power option"}
          </h1>
        </header>

        {computedLogoUri && (
          <div className="w-full max-w-3xl flex justify-center">
            <img
              src={computedLogoUri}
              alt="brand logo"
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border border-gray-300 object-cover mb-5 sm:mb-6"
              onError={(e) => {
                console.warn("[UnifiedPlansOptions] Logo failed to load:", computedLogoUri);
                (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
              }}
              onLoad={() => console.log("[UnifiedPlansOptions] Logo loaded:", computedLogoUri)}
            />
          </div>
        )}

        {showInstant && (
          <div
            onClick={() => goAmountCustomization("INSTANT")}
            className="w-full max-w-3xl bg-white shadow-md rounded-2xl p-6 sm:p-8 mb-5 sm:mb-6 flex items-center cursor-pointer hover:shadow-lg transition"
          >
            <div className="w-10 h-10 sm:w-11 sm:h-11 mr-4 sm:mr-6 rounded-full border border-sky-400 flex items-center justify-center animate-[pulse_1.8s_ease-in-out_infinite] bg-sky-50/40">
              <HiOutlineLightningBolt className="text-sky-500 text-xl sm:text-2xl" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold mb-1 sm:mb-2">
                Instant Power{" "}
                <span className="text-base sm:text-lg text-gray-600">${formatNoRound(instantaneousPower)}</span>
              </h2>
              <p className="text-gray-600 text-sm sm:text-base">Get immediate power when you need it.</p>
            </div>
          </div>
        )}

        {showYearly && (
          <div
            onClick={() => goAmountCustomization("YEARLY")}
            className="w-full max-w-3xl bg-white shadow-md rounded-2xl p-6 sm:p-8 mb-5 sm:mb-6 flex items-center cursor-pointer hover:shadow-lg transition"
          >
            <div className="w-10 h-10 sm:w-11 sm:h-11 mr-4 sm:mr-6 rounded-full border border-sky-400 flex items-center justify-center animate-[pulse_1.8s_ease-in-out_infinite] bg-sky-50/40">
              <HiOutlineCalendar className="text-sky-500 text-xl sm:text-2xl" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold mb-1 sm:mb-2">
                Yearly Power{" "}
                <span className="text-base sm:text-lg text-gray-600">${formatNoRound(yearlyPower / 5)} / year</span>
              </h2>
              <p className="text-gray-600 text-sm sm:text-base">
                Secure your energy needs for the entire year with a convenient plan.
              </p>
            </div>
          </div>
        )}

        {showSelfPayVisible && (
          <div
            onClick={selfPayAmountEligible ? handleSelfPayClick : undefined}
            className={`w-full max-w-3xl bg-white shadow-md rounded-2xl p-6 sm:p-8 mb-5 sm:mb-6 flex items-center transition ${
              selfPayAmountEligible ? "cursor-pointer hover:shadow-lg" : "cursor-not-allowed opacity-60"
            }`}
          >
            <div className="w-10 h-10 sm:w-11 sm:h-11 mr-4 sm:mr-6 rounded-full border border-sky-400 flex items-center justify-center animate-[pulse_1.8s_ease-in-out_infinite] bg-sky-50/40">
              <FaCreditCard className="text-sky-500 text-lg sm:text-xl" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold mb-1 sm:mb-2">Self-Pay Plan</h2>
              <p className="text-gray-600 text-sm sm:text-base">
                {(() => {
                  if (!tiers.length) return "Create a custom plan that fits your budget.";
                  const freqs = Array.from(
                    new Set(
                      tiers
                        .map((t) => (t?.termType || "").toUpperCase())
                        .filter(Boolean)
                        .map((f) =>
                          f === "BIWEEKLY" || f === "BI_WEEKLY" ? "Bi-weekly" : f === "MONTHLY" ? "Monthly" : f
                        )
                    )
                  );
                  const minTerms = tiers.map((t) => t.minTerm).filter((n): n is number => typeof n === "number");
                  const maxTerms = tiers.map((t) => t.maxTerm).filter((n): n is number => typeof n === "number");
                  let minTerm = minTerms.length ? Math.min(...minTerms) : undefined;
                  let maxTerm = maxTerms.length ? Math.max(...maxTerms) : undefined;
                  if (minTerm != null && maxTerm != null && minTerm > maxTerm) [minTerm, maxTerm] = [maxTerm, minTerm];
                  const parts: string[] = [];
                  if (freqs.length) parts.push(freqs.join(" / "));
                  if (minTerm != null && maxTerm != null) parts.push(`${minTerm}–${maxTerm} payments`);
                  return parts.join(" • ") || "Create a custom plan that fits your budget.";
                })()}
              </p>
              {!selfPayAmountEligible && <p className="text-xs text-red-600 mt-2">Not available for this amount.</p>}
            </div>
          </div>
        )}

        {!hideSupercharge && subscribed && (
          <div
            onClick={() => goAmountCustomization("SUPERCHARGE")}
            className="w-full max-w-3xl bg-white shadow-md rounded-2xl p-6 sm:p-8 mb-5 sm:mb-6 flex items-center cursor-pointer hover:shadow-lg transition"
          >
            <div className="w-10 h-10 sm:w-11 sm:h-11 mr-4 sm:mr-6 rounded-full border border-sky-400 flex items-center justify-center animate-[pulse_1.8s_ease-in-out_infinite] bg-sky-50/40">
              <FaCreditCard className="text-sky-500 text-lg sm:text-xl" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold mb-1 sm:mb-2">Supercharge at once</h2>
              <p className="text-gray-600 text-sm sm:text-base">Pay the full amount at once with Supercharge.</p>
            </div>
          </div>
        )}

        {noVisibleOptions && (
          <div className="w-full max-w-3xl bg-white rounded-2xl p-6 sm:p-8 mb-5 sm:mb-6 flex items-center border border-gray-200">
            <div className="w-10 h-10 sm:w-11 sm:h-11 mr-4 sm:mr-6 rounded-full border border-gray-300 flex items-center justify-center bg-gray-50">
              <FaCreditCard className="text-gray-400 text-lg sm:text-xl" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold mb-1 sm:mb-2">No payment options available</h2>
              <p className="text-gray-600 text-sm sm:text-base">There aren’t any payment options for this selection right now.</p>
            </div>
          </div>
        )}

        <Toaster richColors position="top-right" />
      </div>
    </ProtectedRoute>
  );
};

export default UnifiedPlansOptions;
