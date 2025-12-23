// File: src/routes/UnifiedDiscount.tsx

import React, { useMemo, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router";
import { IoIosArrowBack } from "react-icons/io";
import { useMerchantDetail } from "~/hooks/useMerchantDetail";
import { useAvailableDiscounts, Discount } from "~/hooks/useAvailableDiscounts";

// SPA mode clientLoader - enables route module optimization
export const clientLoader = async () => null;

/**
 * Tailwind web version of UnifiedDiscount screen
 * - Uses Remix's useLocation/useNavigate for URL params & navigation
 * - Preserves data/flow logic (params normalization, discount math, routing)
 * - Navigates to /UnifiedPlansOptions (solo) or /UnifiedSplitWithContacts (split)
 * - Visuals tuned to resemble the RN implementation (larger rows, clear separators, fixed CTA)
 */

/* ---------------- Env & URL helpers ---------------- */

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

  // If in the browser, derive from current hostname + :8080
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

  // Final fallback
  return "http://localhost:8080";
}

const BASE_URL: string = resolveBaseUrl();

const RADIO_BLUE = "#00BFFF";

/* ---------------- formatting helpers ---------------- */

function makeFullUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  const isAbsolute = /^https?:\/\//i.test(path);
  if (isAbsolute) return path;
  const base = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

// Money JSON is in **DOLLARS** (major units) across the app
type Money = { amount: string; currency: string };
const round2 = (n: number) => Math.round(n * 100) / 100;
const toDollarsStr = (n: number) => round2(n).toFixed(2);
const ensureMoneyJson = (amountNum: number, currency = "USD"): string => {
  const obj: Money = { amount: toDollarsStr(amountNum), currency };
  return JSON.stringify(obj);
};

// robust truthiness for otherUsers param (could be "[]", "null", JSON string, etc.)
const hasOtherUsers = (raw: string): boolean => {
  if (!raw) return false;
  const s = raw.trim();
  if (!s || s === "null" || s === "undefined") return false;
  try {
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) return parsed.length > 0;
  } catch {
    // not JSON — treat non-empty string as truthy
  }
  return true;
};

// accept 'true'/'false'/'1'/'0'/'yes'/'no'
const parseBoolOrNull = (raw: string): boolean | null => {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(s)) return true;
  if (["false", "0", "no", "n"].includes(s)) return false;
  return null;
};

// Small helper for reading string params safely
const getParam = (qs: URLSearchParams, key: string, fb = ""): string =>
  qs.get(key) ?? fb;

/* ---------------- Component ---------------- */

export default function UnifiedDiscount() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const qs = new URLSearchParams(search);

  // ---------- normalize incoming ----------
  const merchantId = getParam(qs, "merchantId", "");
  const orderAmountStr = getParam(qs, "orderAmount", "0"); // dollars string
  const amount = getParam(qs, "amount", "");
  const powerModeRaw = getParam(qs, "powerMode", "");
  const powerTypeRaw = getParam(qs, "powerType", "");
  const superchargeDetails = getParam(qs, "superchargeDetails", "[]");
  const otherUsers = getParam(qs, "otherUsers", "");
  const recipient = getParam(qs, "recipient", "");
  const requestId = getParam(qs, "requestId", "");
  const transactionType = getParam(qs, "transactionType", "CHECKOUT");
  const totalAmountIn = getParam(qs, "totalAmount", ""); // Money JSON (optional, dollars)
  const incomingDiscount = getParam(qs, "discountList", "[]"); // preserved (not required)
  const displayLogoParam = getParam(qs, "displayLogo", "");
  const displayNameParam = getParam(qs, "displayName", "");
  const splitRaw = getParam(qs, "split", ""); // 'true' | 'false' | ''
  const logoUriParam = getParam(qs, "logoUri", "");

  // forwarded identifiers
  const paymentPlanId = getParam(qs, "paymentPlanId", "");
  const paymentSchemeId = getParam(qs, "paymentSchemeId", "");
  const splitPaymentId = getParam(qs, "splitPaymentId", "");

  const orderAmt = Number(orderAmountStr) || 0;

  // normalize power mode to 'INSTANT' | 'YEARLY'
  const powerMode = useMemo<"INSTANT" | "YEARLY">(() => {
    const m = (powerModeRaw || "").trim().toUpperCase();
    if (m === "YEARLY") return "YEARLY";
    if (m === "INSTANT") return "INSTANT";
    const t = (powerTypeRaw || "").trim().toLowerCase();
    return t === "yearly" ? "YEARLY" : "INSTANT";
  }, [powerModeRaw, powerTypeRaw]);

  const isSoteria = (transactionType || "").toUpperCase() === "SOTERIA_PAYMENT";

  // ---------- fetch merchant + discounts ----------
  const {
    data: merchantResp,
    isLoading: merchantLoading,
    error: merchantError,
  } = useMerchantDetail(merchantId);

  const {
    data: discounts,
    isLoading: discountsLoading,
    error: discountsError,
  } = useAvailableDiscounts(merchantId, orderAmt);

  const [selectedDiscountId, setSelectedDiscountId] = useState<string | null>(null);

  // ---------- compute discounted order amount ----------
  const selectedDiscount = useMemo<Discount | null>(
    () => (discounts ?? []).find((d) => d.id === selectedDiscountId) || null,
    [discounts, selectedDiscountId]
  );

  const effectiveOrderAmt = useMemo(() => {
    if (!selectedDiscount) return orderAmt;

    // Respect minimum purchase threshold if provided
    const min = Number(selectedDiscount.minimumPurchaseAmount ?? 0);
    if (min > 0 && orderAmt < min) return orderAmt;

    if ((selectedDiscount.type || "").toUpperCase() === "PERCENTAGE_OFF") {
      const pct = Number(selectedDiscount.discountPercentage ?? 0);
      const discounted = orderAmt - (orderAmt * pct) / 100;
      return Math.max(0, round2(discounted));
    }

    // Flat amount off
    const off = Number(selectedDiscount.discountAmount ?? 0);
    return Math.max(0, round2(orderAmt - off));
  }, [orderAmt, selectedDiscount]);

  /* -------------- Continue (routing) -------------- */
  const pushWithParams = useCallback(
    (pathname: string, params: Record<string, string>) => {
      const next = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) next.set(k, String(v));
      }
      navigate(`${pathname}?${next.toString()}`);
    },
    [navigate]
  );

  const handleContinue = useCallback(() => {
    const discountIds = selectedDiscountId ? [selectedDiscountId] : [];
    const discountList = JSON.stringify(discountIds);

    // Prefer explicit 'split' flag from UnifiedOptionsPage, otherwise fallback to heuristics
    const splitFlag = parseBoolOrNull(splitRaw);
    let isSplit =
      splitFlag !== null
        ? splitFlag
        : hasOtherUsers(otherUsers) || (totalAmountIn && totalAmountIn.trim().length > 0);

    // If this flow is SOTERIA_PAYMENT, **force** non-split
    if (isSoteria) isSplit = false;

    const discountedStr = toDollarsStr(effectiveOrderAmt);

    if (isSplit) {
      // DISCOUNTED total for split screen, Money JSON in DOLLARS
      const totalAmountJson = ensureMoneyJson(effectiveOrderAmt);

      // Route to contacts with discounted amounts enforced
      pushWithParams("/UnifiedSplitWithContacts", {
        merchantId,
        totalAmount: totalAmountJson, // discounted total (Money JSON)
        amount: discountedStr, // force discounted (string dollars)
        powerMode,
        superchargeDetails,
        otherUsers,
        recipient,
        requestId,
        transactionType,
        orderAmount: discountedStr, // force discounted
        displayLogo: displayLogoParam,
        displayName: displayNameParam,
        logoUri: logoUriParam,
        split: "true",
        discountList, // carry selected discount ids into split flow

        // Forward identifiers
        paymentPlanId,
        paymentSchemeId,
        splitPaymentId,
      });
      return;
    }

    // SOLO / NORMAL FLOW → go to the unified plans/options screen
    pushWithParams("/UnifiedPlansOptions", {
      merchantId,
      amount: discountedStr, // force discounted
      powerMode,
      superchargeDetails,
      otherUsers, // empty string here → no split
      recipient, // single recipient JSON or ''
      requestId,
      transactionType,
      orderAmount: discountedStr, // force discounted
      discountList, // selected discount ids
      // If an upstream total existed, override it with discounted total to keep consistency;
      // otherwise leave it empty for non-split solo flows.
      totalAmount: totalAmountIn ? ensureMoneyJson(effectiveOrderAmt) : "",
      displayLogo: displayLogoParam,
      displayName: displayNameParam,
      logoUri: logoUriParam,
      split: "false",

      // Forward identifiers too
      paymentPlanId,
      paymentSchemeId,
      splitPaymentId,
    });
  }, [
    selectedDiscountId,
    splitRaw,
    otherUsers,
    totalAmountIn,
    isSoteria,
    effectiveOrderAmt,
    pushWithParams,
    merchantId,
    powerMode,
    superchargeDetails,
    recipient,
    requestId,
    transactionType,
    displayLogoParam,
    displayNameParam,
    logoUriParam,
    paymentPlanId,
    paymentSchemeId,
    splitPaymentId,
  ]);

  /* -------------- Loading / Error states -------------- */
  if (merchantLoading || discountsLoading) {
    return (
      <div
        className="min-h-screen grid place-items-center bg-white"
        aria-busy="true"
        aria-live="polite"
      >
        <div className="flex flex-col items-center text-slate-600">
          <div className="h-8 w-8 rounded-full border-2 border-slate-200 border-t-slate-500 animate-spin" />
          <div className="mt-3 text-sm">Loading…</div>
        </div>
      </div>
    );
  }

  if (merchantError) {
    return (
      <div className="min-h-screen grid place-items-center bg-white">
        <div className="text-red-600 text-base">{(merchantError as any).message}</div>
      </div>
    );
  }

  if (discountsError) {
    return (
      <div className="min-h-screen grid place-items-center bg-white">
        <div className="text-red-600 text-base">{(discountsError as any).message}</div>
      </div>
    );
  }

  // Prefer displayLogo from params over derived merchant logo
  // (keeping in case you use it later or for consistency with the RN screen)
  const derivedLogo = makeFullUrl(
    (merchantResp as any)?.data?.brand?.displayLogo || ""
  );
  const logoUri = logoUriParam
    ? makeFullUrl(logoUriParam)
    : displayLogoParam
    ? makeFullUrl(displayLogoParam)
    : derivedLogo;

  /* -------------- Render -------------- */
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Back button only (no header) */}
      <div className="flex items-center p-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-700 hover:text-gray-900 -ml-1 pr-1"
        >
          <IoIosArrowBack className="mr-2" size={24} />
          Back
        </button>
      </div>

      {/* Discounts list — FlashList-like spacing & separators */}
      {(discounts ?? []).length === 0 ? (
        <div className="flex-1 grid place-items-center p-6">
          <div className="text-lg text-slate-500">No discounts available.</div>
        </div>
      ) : (
        <ul className="pt-2 pb-40"> {/* pb-40 ensures content isn't hidden behind fixed footer */}
          {(discounts ?? []).map((item, idx) => {
            const checked = item.id === selectedDiscountId;
            const details =
              item.type === "PERCENTAGE_OFF"
                ? `${item.discountPercentage}% off`
                : `$${item.discountAmount} off`;
            const minStr =
              item.minimumPurchaseAmount &&
              Number(item.minimumPurchaseAmount) > 0
                ? ` on orders ≥ $${item.minimumPurchaseAmount}`
                : "";

            return (
              <li key={item.id}>
                <button
                  type="button"
                  className="w-full"
                  onClick={() =>
                    setSelectedDiscountId((prev) => (prev === item.id ? null : item.id))
                  }
                  aria-pressed={checked}
                >
                  <div className="flex items-center gap-3 px-4 py-3">
                    {logoUri ? (
                      <img
                        src={logoUri}
                        alt="logo"
                        className="h-[60px] w-[60px] min-w-[60px] min-h-[60px] rounded-full object-cover border border-slate-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-[60px] w-[60px] rounded-full bg-slate-200" />
                    )}

                    <div className="flex-1 pr-3 min-w-0 text-left">
                      <div className="text-[16px] font-semibold truncate">
                        {item.discountName}
                      </div>
                      <div className="text-[14px] text-slate-900 truncate">
                        {details}
                        {minStr}
                      </div>
                    </div>

                    {/* Radio (mobile-like look) */}
                    <label
                      htmlFor={`discount-radio-${item.id}`}
                      className="flex items-center gap-2 cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        id={`discount-radio-${item.id}`}
                        type="radio"
                        name="discount-choice"
                        value={item.id}
                        checked={checked}
                        onChange={() =>
                          setSelectedDiscountId((prev) =>
                            prev === item.id ? null : item.id
                          )
                        }
                        className="sr-only"
                      />
                      <span
                        className="inline-block relative rounded-full"
                        style={{
                          width: 20,
                          height: 20,
                          border: `2px solid ${RADIO_BLUE}`,
                        }}
                        aria-hidden
                        data-testid={`discount-radio-${item.id}`}
                      >
                        {checked ? (
                          <span
                            className="absolute inset-[3px] rounded-full"
                            style={{ background: RADIO_BLUE }}
                          />
                        ) : null}
                      </span>
                    </label>
                  </div>
                </button>

                {/* Separator like FlashList ItemSeparatorComponent */}
                {idx !== (discounts?.length ?? 1) - 1 ? (
                  <div className="h-px bg-slate-200 mx-4" />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {/* Continue button (fixed footer, mobile style) */}
      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto w-full max-w-3xl px-4 py-4">
          <button
            onClick={handleContinue}
            className="w-full bg-black text-white py-4 rounded-lg text-[16px] font-semibold active:opacity-90"
            data-testid="continue-button"
          >
            {selectedDiscountId
              ? "Continue with Discount"
              : "Continue without Discount"}
          </button>
        </div>
      </div>
    </div>
  );
}
