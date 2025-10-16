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

/** ---------------- Env + URL helpers ---------------- */
function pickValidBaseUrl(...candidates: Array<unknown>): string | undefined {
  for (const c of candidates) {
    const v = (typeof c === "string" ? c : "").trim();
    const low = v.toLowerCase();
    if (!v) continue;
    if (["false", "0", "null", "undefined"].includes(low)) continue;
    if (/^https?:\/\//i.test(v)) return v.replace(/\/+$/, ""); // strip trailing slash
  }
  return undefined;
}

const BASE_URL =
  pickValidBaseUrl(
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_BASE_URL) as string | undefined,
    (typeof process !== "undefined" && (process as any).env?.REACT_APP_BASE_URL) as string | undefined,
    (typeof process !== "undefined" && (process as any).env?.BASE_URL) as string | undefined
  ) || "http://192.168.1.121:8080";

const isAbsoluteUrl = (u?: string | null) => !!u && /^https?:\/\//i.test(u);
const isDicebearUrl = (u?: string | null) =>
  !!u && /(^https?:\/\/)?([^/]*\.)?api\.dicebear\.com/i.test(u);

function resolveLogoUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (isAbsoluteUrl(path) || isDicebearUrl(path)) return path;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_URL}${p}`;
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
type PowerMode = "INSTANT" | "YEARLY" | "SUPERCHARGE";
export interface SplitEntry { userId: string; amount: string; }
export interface SplitData { userAmounts: SplitEntry[]; }
export interface User { id: string; username: string; logo: string; isCurrentUser?: boolean; }

/** ======================== Component ======================== */
const UnifiedPlansOptions: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // ------------------ BEGIN: UNCONDITIONAL HOOKS BLOCK ------------------
  // Session flags
  const [inApp, setInApp] = useState<boolean>(false);

  // Retrieve user details
  const { data: userDetailsData, isLoading: userLoading, isError: userError } = useUserDetails();

  // Token → checkout details (for config + amount)
  const checkoutToken = typeof window !== "undefined" ? sessionStorage.getItem("checkoutToken") || "" : "";
  const { data: checkoutData, isLoading: checkoutLoading, error: checkoutError } = useCheckoutDetail(checkoutToken);

  // Merchant base id (from updated CheckoutConfigResponse)
  const merchantBaseId = checkoutData?.merchantBaseId ?? checkoutData?.merchantId ?? "";

  // Merchant details (configuration, discounts, brand, etc.)
  const { data: merchantRes, isLoading: merchantLoading, error: merchantError } = useMerchantDetail(merchantBaseId);

  // Local state for optional split/user data via location.state (kept)
  const [splitData, setSplitData] = useState<SplitData | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedDiscounts, setSelectedDiscounts] = useState<string[]>([]);
  // ------------------ END:   UNCONDITIONAL HOOKS BLOCK ------------------

  // Pull optional state (from previous page)
  useEffect(() => {
    const stateData = (location.state as { splitData?: SplitData; users?: User[]; selectedDiscounts?: string[] } | undefined) || {};
    if (stateData.splitData) setSplitData(stateData.splitData);
    setUsers(stateData.users || []);
    if (stateData.selectedDiscounts) setSelectedDiscounts(stateData.selectedDiscounts);
  }, [location.state]);

  // In-app flag
  useEffect(() => {
    const value = typeof window !== "undefined" ? sessionStorage.getItem("inApp") : null;
    setInApp(value === "true");
  }, []);

  // ------------- URL param context -------------
  const amountParam        = normalizeParam(searchParams.get("amount") ?? undefined, "");
  const orderAmountRaw     = normalizeParam(searchParams.get("orderAmount") ?? undefined, "");
  const totalAmount        = normalizeParam(searchParams.get("totalAmount") ?? undefined, "");
  const discountListRaw    = normalizeParam(searchParams.get("discountList") ?? undefined, "[]");
  const displayLogoParam   = normalizeParam(searchParams.get("displayLogo") ?? undefined, "");
  const displayNameParam   = normalizeParam(searchParams.get("displayName") ?? undefined, "");
  const logoUriParam       = normalizeParam(searchParams.get("logoUri") ?? undefined, "");
  const transactionTypeRaw = normalizeParam(searchParams.get("transactionType") ?? undefined, "");
  const splitParam         = normalizeParam(searchParams.get("split") ?? undefined, "");
  const requestId          = normalizeParam(searchParams.get("requestId") ?? undefined, "");

  // ---- Derived params (Hooks: useMemo) — declared BEFORE any early return
  const discountList = useMemo(() => canonicalizeDiscountList(discountListRaw), [discountListRaw]);

  // forward orderAmount (not used for eligibility)
  const orderAmount = useMemo(() => {
    return orderAmountRaw ||
      (amountParam ? String(Number.isFinite(parseFloat(amountParam)) ? parseFloat(amountParam) : 0) : "");
  }, [orderAmountRaw, amountParam]);

  // eligibility amount (STRICTLY amountParam)
  const effectiveAmount = useMemo(() => {
    const n = parseFloat((amountParam || "0").toString().replace(/[$,\s]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }, [amountParam]);

  // ---------- Derived data from queries ----------
  const instantaneousPower = userDetailsData?.data?.user?.instantaneousPower ?? 0;
  const yearlyPower        = userDetailsData?.data?.user?.yearlyPower ?? 0;
  const subscribed         = userDetailsData?.data?.subscribed ?? true;

  // ---- determine type flags
  const upperType       = (transactionTypeRaw || "").toUpperCase().trim();
  const isSend          = upperType === "SEND";
  const isAccept        = upperType === "ACCEPT_REQUEST";
  const isSoteria       = upperType === "SOTERIA_PAYMENT";
  const isAcceptSplit   = upperType === "ACCEPT_SPLIT_REQUEST";
  const isVirtualCardTx = upperType === "VIRTUAL_CARD";
  const isCardTx        = upperType === "CARD";

  // ---- merchant config (with ACCEPT_SPLIT_REQUEST fallback when merchant data is missing)
  const hasMerchantData = !!merchantRes?.data;
  const cfg = merchantRes?.data?.configuration;

  // Fallback: if we're accepting a split and merchant data is missing, assume Self-Pay is allowed & unbounded
  const fallbackSelfPayEnabled = isAcceptSplit && !hasMerchantData;

  const selfPayEnabled =
    (!!cfg?.enableSelfPay && hasMerchantData) || fallbackSelfPayEnabled;

  // Top-level bounds
  const topMinRaw = hasMerchantData ? cfg?.minAmount?.amount : undefined;
  const topMaxRaw = hasMerchantData ? cfg?.maxAmount?.amount : undefined;
  const parsedTopMin = topMinRaw != null ? parseFloat(topMinRaw) : undefined;
  const parsedTopMax = topMaxRaw != null ? parseFloat(topMaxRaw) : undefined;
  const minAmount = parsedTopMin && parsedTopMin > 0 ? parsedTopMin : undefined;
  const maxAmount = parsedTopMax && parsedTopMax > 0 ? parsedTopMax : undefined;

  const withinMin = minAmount == null || effectiveAmount >= minAmount;
  const withinMax = maxAmount == null || effectiveAmount <= maxAmount;

  type AnyTier = { termType?: string; minTerm?: number; maxTerm?: number; minAmount?: string; maxAmount?: string; };
  const tiers: AnyTier[] =
    hasMerchantData && Array.isArray(cfg?.selfPayTiers)
      ? (cfg!.selfPayTiers as AnyTier[])
      : [];

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
    selfPayEnabled &&
    (fallbackSelfPayEnabled ? effectiveAmount > 0 : (withinMin && withinMax && fitsAnyTier));

  // visibility — allow for ACCEPT_SPLIT_REQUEST even if cfg missing
  const hideSelfPayBase = isVirtualCardTx || isSoteria;
  const hideSelfPay     = hideSelfPayBase;

  const showSelfPayCard =
    !hideSelfPay &&
    !(isSend || isAccept) &&
    (selfPayEnabled || isAcceptSplit);

  // Branding resolution (param wins; fallback to merchant brand or checkout brand)
  const brandFromMerchant   = merchantRes?.data?.brand ?? null;
  const fallbackBrand       = brandFromMerchant ?? checkoutData?.brand ?? null;
  const paramLogo           = displayLogoParam ? resolveLogoUrl(displayLogoParam) : undefined;
  const brandLogo           = resolveLogoUrl(fallbackBrand?.displayLogo);
  const computedLogoUri     = logoUriParam || paramLogo || brandLogo;
  const computedDisplayName = displayNameParam || fallbackBrand?.displayName || "";

  // ---- loading / errors (effects: always declared)
  useEffect(() => { if (userError)     toast.error("Error loading user details."); }, [userError]);
  useEffect(() => { if (checkoutError) toast.error("Error loading checkout details."); }, [checkoutError]);
  useEffect(() => { if (merchantError) toast.error("Error loading merchant details."); }, [merchantError]);

  // ------- handlers (hooks) — declared BEFORE any early return -------
  const forwardAll = useMemo(
    () => ({
      merchantId: merchantBaseId,
      amount: orderAmount || amountParam,
      totalAmount,
      orderAmount,
      discountList,
      transactionType: transactionTypeRaw,
      displayLogo: displayLogoParam,
      displayName: displayNameParam,
      split: splitParam,
      logoUri: computedLogoUri ?? "",
      requestId, // forwarded only; not used here
    }),
    [
      merchantBaseId,
      orderAmount,
      amountParam,
      totalAmount,
      discountList,
      transactionTypeRaw,
      displayLogoParam,
      displayNameParam,
      splitParam,
      computedLogoUri,
      requestId,
    ]
  );

  const goAmountCustomization = useCallback(
    (picked: PowerMode) => {
      const params = new URLSearchParams({
        ...Object.entries(forwardAll).reduce<Record<string, string>>((acc, [k, v]) => {
          if (v != null && v !== "") acc[k] = String(v);
          return acc;
        }, {}),
        powerMode: picked,
      });
      navigate(`/UnifiedAmountCustomization?${params.toString()}`);
    },
    [forwardAll, navigate]
  );

  const handleSelfPayClick = useCallback(() => {
    if (!selfPayAmountEligible) return;
    const params = new URLSearchParams({
      ...Object.entries(forwardAll).reduce<Record<string, string>>((acc, [k, v]) => {
        if (v != null && v !== "") acc[k] = String(v);
        return acc;
      }, {}),
      amount: amountParam,
      amountParam, // pass explicitly too (for downstream parity)
    });
    navigate(`/UnifiedSelfPayPaymentPlan?${params.toString()}`);
  }, [forwardAll, selfPayAmountEligible, amountParam, navigate]);

  // ---------------- Early returns come AFTER all hooks ----------------
  const showSpinner = userLoading || (merchantBaseId && merchantLoading) || checkoutLoading;

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
  return (
    <ProtectedRoute>
      <div className="min-h-screen flex flex-col bg-white p-4">
        <header className="w-full max-w-3xl mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-gray-700 hover:text-gray-900 mb-2"
            aria-label="Go back"
          >
            <IoIosArrowBack className="mr-2" size={24} />
            Back
          </button>
          <h1 className="text-3xl font-bold text-left">
            {computedDisplayName ? `Choose a power option for ${computedDisplayName}` : "Choose a power option"}
          </h1>
        </header>

        {/* Logo (centered) */}
        {computedLogoUri && (
          <div className="w-full max-w-3xl flex justify-center">
            <img
              src={computedLogoUri}
              alt="brand logo"
              className="w-20 h-20 rounded-full border border-gray-300 object-cover mb-6"
            />
          </div>
        )}

        {/* Instant Power */}
        <div
          onClick={() => goAmountCustomization("INSTANT")}
          className="w-full max-w-3xl bg-white shadow-md rounded-2xl p-8 mb-6 flex items-center cursor-pointer hover:shadow-lg transition"
        >
          <div className="w-11 h-11 mr-6 rounded-full border border-sky-400 flex items-center justify-center animate-[pulse_1.8s_ease-in-out_infinite] bg-sky-50/40">
            <HiOutlineLightningBolt className="text-sky-500 text-2xl" />
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-2">
              Instant Power{" "}
              <span className="text-lg text-gray-600">
                ${formatNoRound(instantaneousPower)}
              </span>
            </h2>
            <p className="text-gray-600">Get immediate power when you need it.</p>
          </div>
        </div>

        {/* Yearly Power (hide for SEND / ACCEPT_REQUEST) */}
        {!(isSend || isAccept) && subscribed && (
          <div
            onClick={() => goAmountCustomization("YEARLY")}
            className="w-full max-w-3xl bg-white shadow-md rounded-2xl p-8 mb-6 flex items-center cursor-pointer hover:shadow-lg transition"
          >
            <div className="w-11 h-11 mr-6 rounded-full border border-sky-400 flex items-center justify-center animate-[pulse_1.8s_ease-in-out_infinite] bg-sky-50/40">
              <HiOutlineCalendar className="text-sky-500 text-2xl" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">
                Yearly Power{" "}
                <span className="text-lg text-gray-600">
                  ${formatNoRound(yearlyPower / 5)} / year
                </span>
              </h2>
              <p className="text-gray-600">Secure your energy needs for the entire year with a convenient plan.</p>
            </div>
          </div>
        )}

        {/* Self-Pay */}
        {showSelfPayCard && (
          <div
            onClick={selfPayAmountEligible ? handleSelfPayClick : undefined}
            className={`w-full max-w-3xl bg-white shadow-md rounded-2xl p-8 mb-6 flex items-center transition ${
              selfPayAmountEligible ? "cursor-pointer hover:shadow-lg" : "cursor-not-allowed opacity-60"
            }`}
          >
            <div className="w-11 h-11 mr-6 rounded-full border border-sky-400 flex items-center justify-center animate-[pulse_1.8s_ease-in-out_infinite] bg-sky-50/40">
              <FaCreditCard className="text-sky-500 text-xl" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">Self-Pay Plan</h2>
              <p className="text-gray-600">
                {(() => {
                  if (!tiers.length) return "Create a custom plan that fits your budget.";
                  const freqs = Array.from(
                    new Set(
                      tiers
                        .map((t) => (t?.termType || "").toUpperCase())
                        .filter(Boolean)
                        .map((f) => (f === "BIWEEKLY" || f === "BI_WEEKLY" ? "Bi-weekly" : f === "MONTHLY" ? "Monthly" : f))
                    )
                  );
                  const minTerms = tiers.map((t) => t.minTerm).filter((n): n is number => typeof n === "number");
                  const maxTerms = tiers.map((t) => t.maxTerm).filter((n): n is number => typeof n === "number");
                  let minTerm = minTerms.length ? Math.min(...minTerms) : undefined;
                  let maxTerm = maxTerms.length ? Math.max(...maxTerms) : undefined;
                  if (minTerm != null && maxTerm != null && minTerm > maxTerm) {
                    [minTerm, maxTerm] = [maxTerm, minTerm];
                  }
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

        {/* Supercharge (hidden for SEND / ACCEPT_REQUEST / SOTERIA / VIRTUAL_CARD / CARD) */}
        {!isSend && !isAccept && !isSoteria && !isVirtualCardTx && !isCardTx && subscribed && (
          <div
            onClick={() => goAmountCustomization("SUPERCHARGE")}
            className="w-full max-w-3xl bg-white shadow-md rounded-2xl p-8 mb-6 flex items-center cursor-pointer hover:shadow-lg transition"
          >
            <div className="w-11 h-11 mr-6 rounded-full border border-sky-400 flex items-center justify-center animate-[pulse_1.8s_ease-in-out_infinite] bg-sky-50/40">
              <FaCreditCard className="text-sky-500 text-xl" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">Supercharge at once</h2>
              <p className="text-gray-600">Pay the full amount at once with Supercharge.</p>
            </div>
          </div>
        )}

        <Toaster richColors position="top-right" />

        {/* Sign Out Button (conditionally rendered, preserved) */}
        {!inApp && (
          <button className="bg-black text-white font-bold py-4 px-16 rounded-lg mt-8 hover:opacity-80 transition w-full max-w-3xl">
            Sign Out
          </button>
        )}
      </div>
    </ProtectedRoute>
  );
};

export default UnifiedPlansOptions;
