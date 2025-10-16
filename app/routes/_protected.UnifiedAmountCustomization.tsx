// File: app/routes/UnifiedAmountCustomization.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "@remix-run/react";
import { Toaster, toast } from "sonner";
import { IoIosArrowBack } from "react-icons/io";
import { motion, AnimatePresence } from "framer-motion";

import FloatingLabelInputOverdraft from "~/compoments/FloatingLabelInputOverdraft";
import FloatingLabelInputWithInstant from "~/compoments/FloatingLabelInputWithInstant";
import PaymentMethodItem from "~/compoments/PaymentMethodItem";

import { useMerchantDetail } from "~/hooks/useMerchantDetail";
import { useUserDetails } from "~/hooks/useUserDetails";
import { usePaymentMethods, type PaymentMethod } from "~/hooks/usePaymentMethods";

// ✅ Unified commerce (builders + sender used only for SUPERCHARGE submit)
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

/** ---------------- Local Types (match RN) ---------------- */
type AllowedTransactionType =
  | "CHECKOUT"
  | "PAYMENT"
  | "SEND"
  | "ACCEPT_REQUEST"
  | "ACCEPT_SPLIT_REQUEST"
  | "VIRTUAL_CARD"
  | "SOTERIA_PAYMENT";

type PowerMode = "INSTANT" | "YEARLY" | "SUPERCHARGE";

interface SuperchargeField {
  amount: string;
  selectedPaymentMethod: PaymentMethod | null;
}

/** ---------------- Env + URL helpers ---------------- */
const BASE_URL =
  (typeof process !== "undefined" &&
    ((process as any).env?.REACT_APP_BASE_URL || (process as any).env?.BASE_URL)) ||
  "http://192.168.1.121:8080";

const isAbsoluteUrl = (u?: string | null) => !!u && /^https?:\/\//i.test(u);
const isDicebearUrl = (u?: string | null) =>
  !!u && /(^https?:\/\/)?([^/]*\.)?api\.dicebear\.com/i.test(u);

/** Normalize & sanitize URL params */
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

/** Money helpers (do math in cents for accuracy) */
const toCents = (v: string | number): number => {
  const n = typeof v === "number" ? v : parseFloat(v || "0");
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
};
const centsToMajor = (c: number) => c / 100;

/** ======================== Component ======================== */
const UnifiedAmountCustomization: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  /** -------- Read & normalize params (parity with RN) -------- */
  // core / totals (dollars-as-strings)
  const merchantId = normalizeParam(searchParams.get("merchantId"), "");
  const amountParam = normalizeParam(searchParams.get("amount"), "");
  const totalAmount = normalizeParam(searchParams.get("totalAmount"), ""); // Money JSON (optional)
  const orderAmount = normalizeParam(searchParams.get("orderAmount"), "");

  // flow context
  const superchargeDetails = normalizeParam(searchParams.get("superchargeDetails"), "[]"); // not used to pre-seed here
  const discountListRaw = normalizeParam(searchParams.get("discountList"), "[]");
  const powerModeParam = normalizeParam(searchParams.get("powerMode"), "INSTANT");
  const requestId = normalizeParam(searchParams.get("requestId"), "");
  const transactionTypeRaw = normalizeParam(searchParams.get("transactionType"), "");

  // split + send context
  const otherUsersJson = normalizeParam(searchParams.get("otherUsers"), "");
  const recipientJson = normalizeParam(searchParams.get("recipient"), "");

  // branding
  const displayLogoParam = normalizeParam(searchParams.get("displayLogo"), "");
  const displayNameParam = normalizeParam(searchParams.get("displayName"), "");

  // extras (match upstream/downstream)
  const split = normalizeParam(searchParams.get("split"), "");
  const logoUriParam = normalizeParam(searchParams.get("logoUri"), "");
  const paymentPlanId = normalizeParam(searchParams.get("paymentPlanId"), "");
  const paymentSchemeId = normalizeParam(searchParams.get("paymentSchemeId"), "");
  const splitPaymentId = normalizeParam(searchParams.get("splitPaymentId"), "");

  /** -------- Capabilities & mode -------- */
  const txUpper = (transactionTypeRaw || "").toUpperCase() as AllowedTransactionType | "";
  const isSend = txUpper === "SEND";
  // Restrict only for ACCEPT_REQUEST (like RN). ACCEPT_SPLIT_REQUEST is NOT restricted.
  const isAccept = txUpper === "ACCEPT_REQUEST";

  // SEND/ACCEPT_REQUEST force INSTANT; SOTERIA can SUPERCHARGE
  const isRestrictedToInstant = isSend || isAccept;

  const rawPower = (powerModeParam || "INSTANT").toUpperCase() as PowerMode;
  const parsedPower: PowerMode =
    rawPower === "INSTANT" || rawPower === "YEARLY" || rawPower === "SUPERCHARGE" ? rawPower : "INSTANT";
  const powerMode: PowerMode = isRestrictedToInstant ? "INSTANT" : parsedPower;
  const isSupercharge = powerMode === "SUPERCHARGE";

  const discountListCanonical = useMemo(() => canonicalizeDiscountList(discountListRaw), [discountListRaw]);

  /** -------- User + methods + merchant branding -------- */
  const { data: userRes, isLoading: loadingUser } = useUserDetails();
  const userId: string | undefined = userRes?.data?.user?.id;
  const instantaneousPower = userRes?.data?.user?.instantaneousPower ?? 0;
  const subscribed = userRes?.data?.subscribed ?? false;

  // STRICT web hook requires userId and returns PaymentMethod[]
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

  /** -------- Compute "myTarget" (payer's share) -------- */
  const baseAmount = parseFloat(amountParam || "") || 0;
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

  /** -------- Payment methods (cards only) -------- */
  const cards: PaymentMethod[] = useMemo(
    () => (methodsArray ?? []).filter((m: PaymentMethod) => m.type === "card"),
    [methodsArray]
  );
  const pickPrimaryCard = useCallback(() => {
    return cards.find((m) => m.card?.primary) || cards[0] || null;
  }, [cards]);

  /** -------- Local UI & modal state -------- */
  const [instantPowerAmount, setInstantPowerAmount] = useState<string>("");
  const [superchargeFields, setSuperchargeFields] = useState<SuperchargeField[]>(
    isSupercharge ? [{ amount: "", selectedPaymentMethod: null }] : []
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeFieldIndex, setActiveFieldIndex] = useState<number | null>(null);

  // Seed default card for SUPERCHARGE when cards arrive
  useEffect(() => {
    if (!isSupercharge || cards.length === 0) return;
    setSuperchargeFields((prev) =>
      prev.map((f) => (f.selectedPaymentMethod ? f : { ...f, selectedPaymentMethod: pickPrimaryCard() }))
    );
  }, [isSupercharge, cards, pickPrimaryCard]);

  /** -------- SUPERCHARGE field handlers -------- */
  const addField = useCallback(() => {
    setSuperchargeFields((prev) => [...prev, { amount: "", selectedPaymentMethod: pickPrimaryCard() }]);
  }, [pickPrimaryCard]);

  const updateFieldAmount = (idx: number, val: string) => {
    // allow digits + single dot, max 2 decimals (or empty)
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

  /** -------- Validation / disable logic -------- */
  const fieldsWithPositive = superchargeFields.filter((f) => toCents(f.amount) > 0);
  const sumSuperchargeCents = fieldsWithPositive.reduce((acc, f) => acc + toCents(f.amount), 0);
  const enteredInstantCents = isSupercharge ? 0 : toCents(instantPowerAmount);
  const totalEnteredCents = enteredInstantCents + sumSuperchargeCents;

  const hasEmptyInstant = isSupercharge ? false : instantPowerAmount.trim() === "";
  const noPositiveSupercharges = fieldsWithPositive.length === 0;
  const hasMissingCard = fieldsWithPositive.some((f) => !f.selectedPaymentMethod?.id);
  const exactMatch = totalEnteredCents === myTargetCents;

  const disabled =
    (isSupercharge ? noPositiveSupercharges || hasMissingCard : hasEmptyInstant || hasMissingCard) || !exactMatch;

  /** -------- Navigate to UnifiedPlans (non-SUPERCHARGE) -------- */
  const goContinue = () => {
    if (disabled) {
      toast.info("Please complete the amounts and card selections first.");
      return;
    }

    const details = superchargeFields
      .filter((f) => toCents(f.amount) > 0)
      .map((f) => ({
        amount: (toCents(f.amount) / 100).toFixed(2),
        paymentMethodId: f.selectedPaymentMethod?.id!,
      }));

    const forwardAmount = isSupercharge
      ? centsToMajor(myTargetCents).toFixed(2)
      : (toCents(instantPowerAmount) / 100).toFixed(2);

    const baseParams = new URLSearchParams({
      // core
      merchantId,
      amount: forwardAmount,
      powerMode,

      // flow context
      superchargeDetails: JSON.stringify(details.length ? details : []),
      discountList: discountListCanonical,
      requestId,
      transactionType: transactionTypeRaw,

      // split + send
      otherUsers: otherUsersJson,
      recipient: recipientJson,

      // totals / branding
      totalAmount,
      orderAmount,
      displayLogo: displayLogoParam,
      displayName: displayNameParam,

      // extras
      split,
      logoUri: logoUriParam,
      paymentPlanId,
      paymentSchemeId,
      splitPaymentId,
    });

    navigate(`/UnifiedPlans?${baseParams.toString()}`);
  };

  /** -------- SUPERCHARGE immediate submit (uses useUnifiedCommerce + builders) -------- */
  const { mutateAsync: runUnified, isPending: unifiedPending } = useUnifiedCommerce();

  // Parse discount ids to string[]
  const parseDiscountIds = (): string[] => {
    try {
      const arr = JSON.parse(discountListCanonical);
      return Array.isArray(arr) ? arr.map(String) : [];
    } catch {
      return [];
    }
  };

  const parseRecipient = (): SendRecipient | null => {
    if (!recipientJson) return null;
    try {
      const o = JSON.parse(recipientJson);
      const rid = String(o?.recipientId || "");
      const amt = Number(o?.amount || 0);
      if (!rid || !Number.isFinite(amt) || amt <= 0) return null;
      return { recipientId: rid, amount: amt };
    } catch {
      return null;
    }
  };

  const sendByType = async (type: AllowedTransactionType, payload: any) => {
    const start = Date.now();
    try {
      const res = await runUnified(payload);
      try {
        // eslint-disable-next-line no-console
        console.log(`[UAC → ${type}] SUCCESS in ${Date.now() - start}ms`, res);
      } catch {}
      return res;
    } catch (err: any) {
      try {
        // eslint-disable-next-line no-console
        console.log(`[UAC → ${type}] ERROR in ${Date.now() - start}ms`, {
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
    if (disabled) {
      toast.info(
        "Please fill supercharge amounts (for those you use), select a card for each positive amount, and ensure totals equal the amount."
      );
      return;
    }

    const details = fieldsWithPositive.map((f) => ({
      amount: Number((toCents(f.amount) / 100).toFixed(2)), // dollars major units
      paymentMethodId: f.selectedPaymentMethod!.id,
    }));

    const today = new Date().toISOString().split("T")[0];
    const discountIds = parseDiscountIds();
    const hasDiscounts = discountIds.length > 0;

    // Common block: no splitPaymentsList for pure SUPERCHARGE submit
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
      schemeTotalAmount: centsToMajor(myTargetCents),
      otherUsers: parsedOtherUsers,
      ...(hasDiscounts ? { discountIds } : {}),
    };

    try {
      switch (transactionType) {
        case "CHECKOUT": {
          const req = buildCheckoutRequest(
            {
              checkoutMerchantId: merchantId,
              checkoutTotalAmount: { amount: centsToMajor(myTargetCents), currency: "USD" },
              checkoutType: "ONLINE",
              checkoutRedirectUrl: null,
              checkoutReference: null,
              checkoutDetails: null,
              checkoutToken: null,
            },
            common
          );
          await sendByType("CHECKOUT", req);
          navigate(`/SuccessPayment?amount=${encodeURIComponent(centsToMajor(myTargetCents).toFixed(2))}&replace_to_index=1`);
          break;
        }
        case "PAYMENT": {
          const req = buildPaymentRequest(
            { merchantId, paymentTotalAmount: { amount: centsToMajor(myTargetCents), currency: "USD" } },
            common
          );
          await sendByType("PAYMENT", req);
          navigate(`/SuccessPayment?amount=${encodeURIComponent(centsToMajor(myTargetCents).toFixed(2))}&replace_to_index=1`);
          break;
        }
        case "SEND": {
          const recipient = parseRecipient();
          if (!recipient) {
            toast.info("Provide a valid single recipient JSON.");
            return;
          }
          const req = buildSendRequest(recipient, { note: "Transfer" }, common);
          await sendByType("SEND", req);
          navigate(`/SuccessPayment?amount=${encodeURIComponent(Number(recipient.amount).toFixed(2))}&replace_to_index=1`);
          break;
        }
        case "ACCEPT_REQUEST": {
          if (!requestId) {
            toast.info("Missing requestId for ACCEPT_REQUEST.");
            return;
          }
          const req = buildAcceptRequest(requestId, common);
          await sendByType("ACCEPT_REQUEST", req);
          navigate(`/SuccessPayment?amount=${encodeURIComponent(centsToMajor(myTargetCents).toFixed(2))}&replace_to_index=1`);
          break;
        }
        case "ACCEPT_SPLIT_REQUEST": {
          if (!requestId) {
            toast.info("Missing requestId for ACCEPT_SPLIT_REQUEST.");
            return;
          }
          const req = buildAcceptSplitRequest(requestId, common);
          await sendByType("ACCEPT_SPLIT_REQUEST", req);
          navigate(`/SuccessPayment?amount=${encodeURIComponent(centsToMajor(myTargetCents).toFixed(2))}&replace_to_index=1`);
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
          // Back end generally requires all three for Soteria
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
            split,
            logoUri: logoUriParam || undefined,
          };

          const req = buildSoteriaPaymentRequest(
            {
              merchantId,
              soteriaPaymentTotalAmount: { amount: centsToMajor(myTargetCents), currency: "USD" },
              paymentTotalAmount: { amount: centsToMajor(myTargetCents), currency: "USD" }, // compat alias
              soteriaPayload,
              paymentPlanId,
              paymentSchemeId,
              splitPaymentId,
            },
            common
          );

          await sendByType("SOTERIA_PAYMENT", req);
          navigate(`/SuccessPayment?amount=${encodeURIComponent(centsToMajor(myTargetCents).toFixed(2))}&replace_to_index=1`);
          break;
        }
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
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
    split,
    discountListCanonical,
    recipientJson,
  ]);

  /** -------- Loading states -------- */
  if ((!preferParamsBranding && loadingMerchant) || loadingUser || loadingMethods) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <span>Loading…</span>
      </div>
    );
  }

  const errorMsg = (merchantError as any)?.message || (methodsError as any)?.message || "";

  /** -------- Render -------- */
  return (
    <div className="min-h-screen bg-white p-6">
      {/* Top bar with Back and the ONLY visible Add Supercharge button */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate(-1)} className="flex items-center text-gray-700 hover:text-gray-900">
          <IoIosArrowBack size={20} className="mr-2" /> Back
        </button>

        {/* Header “Add Supercharge” button: visible when user is subscribed and flow isn't restricted */}
        {subscribed && !isRestrictedToInstant && (
          <button
            onClick={addField}
            className="px-3 py-2 rounded-md bg-black text-white font-semibold hover:bg-gray-900"
          >
            Add Supercharge
          </button>
        )}
      </div>

      {computedLogoUri && (
        <div className="flex items-center justify-center mb-4">
          <img
            src={computedLogoUri}
            alt={headerName || "brand"}
            className="w-24 h-24 rounded-full border border-gray-300 object-cover"
          />
        </div>
      )}

      {errorMsg ? (
        <div className="text-center text-red-600 mb-3">{errorMsg}</div>
      ) : null}

      <h1 className="text-xl font-bold mb-2">
        {headerName
          ? `Customize Your $${centsToMajor(myTargetCents).toFixed(2)} for ${headerName}`
          : `Customize Your $${centsToMajor(myTargetCents).toFixed(2)}`}
      </h1>

      {/* Instant (or Yearly) input – hidden for SUPERCHARGE */}
      {!isSupercharge && (
        <FloatingLabelInputWithInstant
          label={powerMode === "YEARLY" ? "Yearly Power Amount" : "Instant Power Amount"}
          value={instantPowerAmount}
          onChangeText={(v: string) => {
            if (/^\d*(\.\d{0,2})?$/.test(v) || v === "") setInstantPowerAmount(v);
          }}
          instantPower={instantaneousPower}
          powerType={powerMode === "YEARLY" ? "yearly" : "instantaneous"}
        />
      )}

      {/* Supercharge fields */}
      {superchargeFields.map((f, i) => (
        <div key={i} className="mt-4">
          <FloatingLabelInputOverdraft
            label={`Supercharge #${i + 1}`}
            value={f.amount}
            onChangeText={(v) => updateFieldAmount(i, v)}
            selectedMethod={f.selectedPaymentMethod}
            onPaymentMethodPress={() => {
              if (!f.selectedPaymentMethod) {
                setSuperchargeFields((prev) => {
                  const next = [...prev];
                  next[i] = { ...next[i], selectedPaymentMethod: pickPrimaryCard() };
                  return next;
                });
              }
              setActiveFieldIndex(i);
              setIsModalOpen(true);
            }}
          />
        </div>
      ))}

      {/* If explicitly in SUPERCHARGE mode, the inline Add button is retained but hidden to keep logic intact */}
      {isSupercharge && (
        <div className="mt-4 hidden">
          <button
            onClick={addField}
            className="w-full border border-gray-300 py-2 font-bold rounded-lg hover:bg-gray-50"
          >
            Add Supercharge
          </button>
        </div>
      )}

      {/* CTA */}
      <div className="mt-6">
        {!isSupercharge ? (
          <button
            disabled={disabled}
            onClick={goContinue}
            className={`w-full py-3 font-semibold rounded-lg ${
              disabled ? "bg-gray-300 text-gray-600 cursor-not-allowed" : "bg-black text-white hover:bg-gray-900"
            }`}
          >
            Continue
          </button>
        ) : (
          <button
            disabled={disabled || unifiedPending}
            onClick={runSupercharge}
            className={`w-full py-3 font-semibold rounded-lg ${
              disabled || unifiedPending ? "bg-gray-300 text-gray-600 cursor-not-allowed" : "bg-black text-white hover:bg-gray-900"
            }`}
          >
            {unifiedPending
              ? "Processing…"
              : txUpper === "VIRTUAL_CARD"
              ? "Pay & Issue Card"
              : "Pay & Finish"}
          </button>
        )}

        {/* Totals helper */}
        {!exactMatch && (
          <p className="text-xs text-gray-500 mt-2">
            Entered total (${centsToMajor(totalEnteredCents).toFixed(2)}) must equal your target ($
            {centsToMajor(myTargetCents).toFixed(2)}).
          </p>
        )}
      </div>

      {/* Card Picker Modal (framer-motion) */}
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
                {/* Payment Settings button is intentionally hidden (kept, not removed) */}
                <button
                  onClick={() => navigate("/payment-settings")}
                  className="mb-4 bg-black text-white px-4 py-2 rounded-lg hidden"
                >
                  Payment Settings
                </button>

                {(cards ?? []).map((m: PaymentMethod, idx: number, arr: PaymentMethod[]) => (
                  <PaymentMethodItem
                    key={m.id}
                    method={m}
                    selectedMethod={
                      activeFieldIndex != null
                        ? superchargeFields[activeFieldIndex]?.selectedPaymentMethod ?? null
                        : null
                    }
                    onSelect={handleMethodSelect}
                    isLastItem={idx === arr.length - 1}
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
