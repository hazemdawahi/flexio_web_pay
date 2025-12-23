// src/routes/UnifiedOptionsPage.tsx

import React, { useMemo } from "react";
import {
  HiOutlineShoppingCart,
  HiOutlineUsers,
  HiOutlineEye,
} from "react-icons/hi";
import { useNavigate, useSearchParams } from "react-router";
import { useCheckoutDetail } from "~/hooks/useCheckoutDetail";
import { useMerchantDetail } from "~/hooks/useMerchantDetail";
import { useLogoutWeb } from "~/hooks/useLogout";
import { useAvailableDiscounts } from "~/hooks/useAvailableDiscounts";
import { useSession } from "~/context/SessionContext";

// SPA mode clientLoader - enables route module optimization
export const clientLoader = async () => null;

/** ---------------- Types ---------------- */
export type UnifiedOperationType = "CHECKOUT";

/** ---------------- Env + URL helpers ---------------- */

const isBrowser = typeof window !== "undefined";

function resolveBaseUrl(): string {
  // Vite-style env vars
  const fromEnv =
    import.meta.env.VITE_API_HOST ||
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_BASE_URL;

  if (fromEnv && typeof fromEnv === "string" && fromEnv.trim().length > 0) {
    return fromEnv.trim().replace(/\/+$/, "");
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
      // ignore and fall through
    }
  }

  return "http://localhost:8080";
}

const BASE_URL = resolveBaseUrl();

const isAbsoluteUrl = (u?: string | null) => !!u && /^https?:\/\//i.test(u);
const isDicebearUrl = (u?: string | null) =>
  !!u && /(^https?:\/\/)?([^/]*\.)?api\.dicebear\.com/i.test(u);

/** Remove "null"/"undefined" and stray quotes from params. */
const sanitizeParamString = (raw?: string) => {
  const s = (raw ?? "").trim();
  if (!s) return "";
  const low = s.toLowerCase();
  if (low === "null" || low === "undefined") return "";
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }
  return s;
};

/** Resolve logo to an absolute URL usable in <img>. */
function resolveLogoUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (isAbsoluteUrl(path) || isDicebearUrl(path)) return path;

  const base = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

/** Canonicalize a discount list into JSON array of unique IDs (as strings). */
function canonicalizeDiscountList(raw: string): string {
  if (!raw || !raw.trim()) return "[]";

  const extractId = (x: any): string => {
    if (x == null) return "";
    if (typeof x === "string" || typeof x === "number") return String(x).trim();
    if (typeof x === "object") {
      const v = x.id ?? x.discountId ?? x.code ?? "";
      return typeof v === "string" || typeof v === "number"
        ? String(v).trim()
        : "";
    }
    return "";
  };
  const uniq = (a: string[]) => Array.from(new Set(a.filter(Boolean)));

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return JSON.stringify(uniq(parsed.map(extractId)));
    if (typeof parsed === "string")
      return JSON.stringify(uniq(parsed.split(",").map((s) => s.trim())));
  } catch {
    return JSON.stringify(uniq(raw.split(",").map((s) => s.trim())));
  }
  return "[]";
}

/** Money helper: parse {amount,currency} from JSON with amount in DOLLARS (major). */
type Money = { amount: string; currency: string };
const parseMoneyMajor = (json: string): number => {
  try {
    const m = JSON.parse(json) as Money;
    const raw = m?.amount ?? "0";
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
};

/** Normalize value (string[] | string | undefined) to a single sanitized string. */
const normalizeParam = (v: string | string[] | undefined, fallback = ""): string =>
  sanitizeParamString(Array.isArray(v) ? v[0] : v ?? fallback);

/** ======================== Component ======================== */
const UnifiedOptionsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Session info (now the single source of truth for in-app mode)
  const { inApp, initialized } = useSession();

  // Hook for sign out
  const { logout, isLoggingOut } = useLogoutWeb();

  // ---- URL-driven context ----
  const transactionType: UnifiedOperationType = "CHECKOUT";

  const displayLogoRaw = normalizeParam(
    searchParams.get("displayLogo") ?? undefined,
    ""
  );
  const displayNameRaw = normalizeParam(
    searchParams.get("displayName") ?? undefined,
    ""
  );
  const totalAmountRaw = normalizeParam(
    searchParams.get("totalAmount") ?? undefined,
    ""
  );
  const amountParam = normalizeParam(
    searchParams.get("amount") ?? undefined,
    ""
  );
  const discountListParam = normalizeParam(
    searchParams.get("discountList") ?? undefined,
    "[]"
  );
  const splitPaymentId = normalizeParam(
    searchParams.get("splitPaymentId") ?? undefined,
    ""
  );

  // Retrieve token from sessionStorage and call checkout hook
  const checkoutToken =
    typeof window !== "undefined"
      ? sessionStorage.getItem("checkoutToken") || ""
      : "";
  const hasToken = !!checkoutToken;

  const { data: checkoutRes, isLoading, error } = useCheckoutDetail(checkoutToken);

  const merchantBaseId =
    checkoutRes?.merchantBaseId ?? checkoutRes?.merchantId ?? "";

  const amountFromCheckout = checkoutRes?.checkout?.totalAmount?.amount
    ? parseFloat(checkoutRes.checkout.totalAmount.amount)
    : 0;

  const orderAmount =
    totalAmountRaw
      ? parseMoneyMajor(totalAmountRaw)
      : parseFloat(amountParam || "") ||
        amountFromCheckout ||
        0;

  const hasAmount =
    Boolean(amountParam) ||
    Boolean(totalAmountRaw) ||
    Boolean(checkoutRes?.checkout?.totalAmount?.amount);

  const {
    data: merchantRes,
    isLoading: merchantLoading,
    error: merchantError,
  } = useMerchantDetail(merchantBaseId);

  const { data: availableDiscountsRaw } = useAvailableDiscounts(
    merchantBaseId,
    orderAmount
  );
  const availableDiscounts = Array.isArray(availableDiscountsRaw)
    ? availableDiscountsRaw
    : [];
  const discountsList = merchantBaseId ? availableDiscounts : [];
  const hasDiscounts = discountsList.length > 0;

  // ---------- Merchant/Brand details ----------
  const brandFromMerchant = merchantRes?.data?.brand ?? null;
  const configurationFromMerchant = merchantRes?.data?.configuration;
  const splitEnabledByMerchant = !!configurationFromMerchant?.enableSplitPay;

  const fallbackBrand = brandFromMerchant ?? checkoutRes?.brand ?? null;
  const paramLogo = displayLogoRaw ? resolveLogoUrl(displayLogoRaw) : undefined;
  const brandLogo = resolveLogoUrl(fallbackBrand?.displayLogo);
  const computedLogoUri = paramLogo ?? brandLogo;
  const computedDisplayName = displayNameRaw || fallbackBrand?.displayName || "";

  const discountListClean = useMemo(
    () => canonicalizeDiscountList(discountListParam),
    [discountListParam]
  );

  const isTransfer = false;
  const isAcceptSplit = false;
  const isSoteria = false;

  const canShowComplete = isAcceptSplit || hasAmount || isSoteria || hasAmount;

  const subscribed = true;

  const showSplitAction =
    subscribed && splitEnabledByMerchant && !isAcceptSplit && !isSoteria;

  const forwardCommon = {
    transactionType,
    displayLogo: displayLogoRaw,
    displayName: computedDisplayName,
    discountList: discountListClean,
    splitPaymentId,
    merchantId: merchantBaseId,
  };

  const forwardAll = {
    ...forwardCommon,
    totalAmount:
      totalAmountRaw ||
      JSON.stringify({ amount: String(orderAmount || 0), currency: "USD" }),
    amount: amountParam || String(orderAmount || 0),
    orderAmount: String(orderAmount || 0),
  };

  const buildParams = (obj: Record<string, string>) =>
    new URLSearchParams(
      Object.entries(obj).reduce<Record<string, string>>((acc, [k, v]) => {
        if (v != null && v !== "") acc[k] = String(v);
        return acc;
      }, {})
    ).toString();

  const goComplete = () => {
    const baseParams = {
      ...forwardAll,
      split: "false",
      logoUri: computedLogoUri ?? "",
    };

    if (hasDiscounts) {
      navigate(`/UnifiedDiscount?${buildParams(baseParams)}`);
      return;
    }

    navigate(`/UnifiedPlansOptions?${buildParams(baseParams)}`);
  };

  const goSplit = () => {
    if (!showSplitAction) return;

    const totalAmountForSplit =
      forwardAll.totalAmount ||
      JSON.stringify({ amount: String(orderAmount || 0), currency: "USD" });

    const baseParams = {
      ...forwardAll,
      totalAmount: totalAmountForSplit,
      split: "true",
      logoUri: computedLogoUri ?? "",
    };

    if (hasDiscounts) {
      navigate(`/UnifiedDiscount?${buildParams(baseParams)}`);
      return;
    }

    navigate(`/UnifiedSplitWithContacts?${buildParams(baseParams)}`);
  };

  const hasBlockingError = !!error || !!merchantError;

  return (
    <div className="min-h-screen flex flex-col items-center bg-white px-6 pt-16 pb-6">
      {/* Loading / Error states */}
      {(isLoading || merchantLoading) && (
        <div className="w-full max-w-3xl mb-6 p-6 rounded-2xl border border-gray-200 flex items-center justify-center">
          <span className="text-gray-700">Loading…</span>
        </div>
      )}

      {!isLoading && !merchantLoading && hasBlockingError && (
        <div className="w-full max-w-3xl mb-6 p-6 rounded-2xl border border-red-300 bg-red-50">
          <span className="text-red-700">Error loading data.</span>
        </div>
      )}

      {/* Logo (if any) */}
      {!isLoading && !merchantLoading && !hasBlockingError && computedLogoUri && (
        <img
          src={computedLogoUri}
          alt="brand logo"
          className="w-20 h-20 rounded-full border border-gray-300 object-cover mb-4 animate-pulse"
        />
      )}

      {/* Header */}
      {!isLoading && !merchantLoading && !hasBlockingError && (
        <header className="w-full max-w-3xl text-center mb-6">
          <h1 className="text-[22px] font-bold">
            {computedDisplayName
              ? computedDisplayName
              : "Choose how you want to proceed"}
          </h1>
          {!!computedDisplayName && (
            <p className="text-gray-600 mt-2 text-sm">
              {hasDiscounts
                ? "Choose a discount, then pick your plan."
                : "Choose how you want to proceed"}
            </p>
          )}
        </header>
      )}

      {/* Main actions */}
      {!isLoading && !merchantLoading && !hasBlockingError && (
        <>
          {hasToken ? (
            <>
              {/* Complete flow */}
              {canShowComplete && (
                <div
                  onClick={goComplete}
                  className="w-full max-w-3xl bg-white shadow-md rounded-2xl p-6 mb-4 flex items-center cursor-pointer hover:shadow-lg transition"
                >
                  <div className="w-11 h-11 mr-4 rounded-full border border-sky-400 flex items-center justify-center animate-[pulse_1.8s_ease-in-out_infinite] bg-sky-50/40">
                    <HiOutlineShoppingCart className="text-sky-500 text-xl" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg font-bold mb-1">Complete Transaction</h2>
                    <p className="text-gray-600 text-sm">
                      {hasDiscounts
                        ? "Choose a discount, then pick your plan."
                        : "Proceed to choose a payment plan."}
                    </p>
                  </div>
                </div>
              )}

              {/* Split (only if enabled) */}
              {showSplitAction && (
                <div
                  onClick={goSplit}
                  className="w-full max-w-3xl bg-white shadow-md rounded-2xl p-6 mb-4 flex items-center cursor-pointer hover:shadow-lg transition"
                >
                  <div className="w-11 h-11 mr-4 rounded-full border border-sky-400 flex items-center justify-center animate-[pulse_1.8s_ease-in-out_infinite] bg-sky-50/40">
                    <HiOutlineUsers className="text-sky-500 text-xl" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg font-bold mb-1">Split Purchase</h2>
                    <p className="text-gray-600 text-sm">
                      Share the cost with friends or teammates.
                    </p>
                  </div>
                </div>
              )}

              {!canShowComplete && !showSplitAction && (
                <div className="w-full max-w-3xl bg-gray-100 rounded-2xl p-4">
                  <p className="text-gray-700 text-sm">No available actions yet.</p>
                </div>
              )}
            </>
          ) : (
            // If no valid token, show Monitor Product
            <div
              onClick={() => navigate("/product-details")}
              className="w-full max-w-3xl bg-white shadow-md rounded-2xl p-6 mb-4 flex items-center cursor-pointer hover:shadow-lg transition"
            >
              <div className="w-11 h-11 mr-4 rounded-full border border-sky-400 flex items-center justify-center animate-[pulse_1.8s_ease-in-out_infinite] bg-sky-50/40">
                <HiOutlineEye className="text-sky-500 text-xl" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold mb-1">Monitor Product</h2>
                <p className="text-gray-600 text-sm">
                  Keep an eye on product details and get notified when available.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Sign Out Button (hidden when in-app; also wait for initialization to avoid flicker) */}
      {initialized && !inApp && (
        <button
          className="bg-black text-white font-bold py-4 px-16 rounded-lg mt-8 hover:opacity-80 transition w-full max-w-3xl disabled:opacity-60"
          aria-busy={isLoggingOut ? "true" : "false"}
          disabled={isLoggingOut}
          onClick={async () => {
            try {
              await logout();
            } finally {
              navigate("/login");
            }
          }}
        >
          {isLoggingOut ? "Signing Out…" : "Sign Out"}
        </button>
      )}
    </div>
  );
};

export default UnifiedOptionsPage;
