// File: app/routes/UnifiedPayCustomizeScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "@remix-run/react";
import { toast, Toaster } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { IoIosArrowBack } from "react-icons/io";

// Hooks
import { useUserDetails } from "~/hooks/useUserDetails";
import { usePaymentMethods, type PaymentMethod } from "~/hooks/usePaymentMethods";
import {
  useUnifiedCommerce,
  type UnifiedCommerceRequest,
  type UnifiedCommerceResponse,
} from "~/hooks/useUnifiedCommerce";

// UI
import PaymentMethodItem from "~/compoments/PaymentMethodItem";
import FloatingLabelInputOverdraft from "~/compoments/FloatingLabelInputOverdraft";

// ─────────────────────────────────────────────────────────────
// Types & helpers (aligned with RN screen; adapted for web)
// ─────────────────────────────────────────────────────────────

type UnifiedOperationType =
  | "CHECKOUT"
  | "PAYMENT"
  | "SEND"
  | "ACCEPT_REQUEST"
  | "ACCEPT_SPLIT_REQUEST"
  | "VIRTUAL_CARD"
  | "SOTERIA_PAYMENT";

type Field = {
  id: string;
  label: string;
  value: string;
  // Keep full PaymentMethod if available; store a stub when unknown to preserve id.
  selectedMethod: PaymentMethod | { id: string; type: string } | null;
  error?: string;
};

const ACCENT = "#00BFFF";

const nearlyEqual = (a: number, b: number, eps = 0.01) => Math.abs(a - b) < eps;

const makeMethodStub = (id: string): { id: string; type: string } => ({ id, type: "external" });

function titleByType(t?: UnifiedOperationType | string) {
  switch (t) {
    case "CHECKOUT":
      return "Customize Checkout Payment";
    case "PAYMENT":
      return "Customize Payment";
    case "SEND":
      return "Customize Send";
    case "ACCEPT_REQUEST":
    case "ACCEPT_SPLIT_REQUEST":
      return "Customize Acceptance";
    case "VIRTUAL_CARD":
      return "Customize Card Payment";
    case "SOTERIA_PAYMENT":
      return "Customize Soteria Payment";
    default:
      return "Customize & Pay";
  }
}

/* -------------------- MoneyLike helpers -------------------- */
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

/* -------------------- Read helpers (first-due, supers, discounts, soteria total) -------------------- */

function getFirstDueAmount(req: UnifiedCommerceRequest | null): number {
  if (!req) return 0;
  const anyReq: any = req;

  const cardList = (anyReq?.card?.splitPaymentsList ?? []) as any[];
  if (Array.isArray(cardList) && cardList.length > 0) return Number(cardList[0]?.amount ?? 0) || 0;

  const planList = (anyReq?.plan?.splitPaymentsList ?? []) as any[];
  if (Array.isArray(planList) && planList.length > 0) return Number(planList[0]?.amount ?? 0) || 0;

  const rootList = (anyReq?.splitPaymentsList ?? []) as any[];
  if (Array.isArray(rootList) && rootList.length > 0) return Number(rootList[0]?.amount ?? 0) || 0;

  return 0;
}

// For SOTERIA_PAYMENT we might not have split payments; prefer the explicit total if present
function getSoteriaExplicitTotal(req: UnifiedCommerceRequest | null): number {
  if (!req) return 0;
  const anyReq: any = req;
  if (anyReq?.type !== "SOTERIA_PAYMENT") return 0;

  const a1 = toNumberFromMoneyLike(anyReq?.soteriaPaymentTotalAmount);
  if (a1 > 0) return a1;

  const a2 = toNumberFromMoneyLike(anyReq?.paymentTotalAmount);
  if (a2 > 0) return a2;

  const p1 = Number(anyReq?.totalPlanAmount || 0);
  if (p1 > 0) return p1;
  const p2 = Number(anyReq?.card?.totalPlanAmount || 0);
  if (p2 > 0) return p2;
  const p3 = Number(anyReq?.plan?.totalPlanAmount || 0);
  if (p3 > 0) return p3;

  return 0;
}

// Read ONLY splitSuperchargeDetails (legacy tolerant). Prefer plan → root → (legacy) card.
function getExistingSplitSupers(
  req: UnifiedCommerceRequest | null
): { amount: number; paymentMethodId: string }[] {
  if (!req) return [];
  const anyReq: any = req;

  const planSupers = anyReq?.plan?.splitSuperchargeDetails;
  if (Array.isArray(planSupers)) return planSupers;

  const rootSupers = anyReq?.splitSuperchargeDetails;
  if (Array.isArray(rootSupers)) return rootSupers;

  const cardSupers = anyReq?.card?.splitSuperchargeDetails;
  if (Array.isArray(cardSupers)) return cardSupers;

  return [];
}

function getExistingDiscountIds(req: UnifiedCommerceRequest | null): string[] {
  if (!req) return [];
  const anyReq: any = req;
  if (Array.isArray(anyReq?.checkout?.discountIds)) return (anyReq.checkout.discountIds as any[]).map(String);
  if (Array.isArray(anyReq?.plan?.discountIds)) return (anyReq.plan.discountIds as any[]).map(String);
  if (Array.isArray(anyReq?.discountIds)) return (anyReq.discountIds as any[]).map(String);
  if (Array.isArray(anyReq?.card?.discountIds)) return (anyReq.card.discountIds as any[]).map(String); // legacy
  return [];
}

// Place discounts into canonical spot for the op type (CHECKOUT → checkout; others → root)
function withDiscountIdsForwarded(req: UnifiedCommerceRequest): UnifiedCommerceRequest {
  const anyReq: any = req;
  const discountIds = getExistingDiscountIds(anyReq).filter(Boolean);
  if (discountIds.length === 0) return anyReq;

  const t: UnifiedOperationType | string | undefined = anyReq?.type;
  if (t === "CHECKOUT" && anyReq?.checkout) {
    return { ...anyReq, checkout: { ...anyReq.checkout, discountIds } } as UnifiedCommerceRequest;
  }
  return { ...anyReq, discountIds } as UnifiedCommerceRequest;
}

/* -------------------- SPLIT helpers -------------------- */

// Get otherUsers from canonical locations (prefer plan → root; legacy card tolerated)
function getOtherUsers(req: UnifiedCommerceRequest | null): { userId: string; amount: number }[] {
  if (!req) return [];
  const anyReq: any = req;
  const fromPlan = anyReq?.plan?.otherUsers;
  if (Array.isArray(fromPlan)) return fromPlan;
  const fromRoot = anyReq?.otherUsers;
  if (Array.isArray(fromRoot)) return fromRoot;
  const fromCard = anyReq?.card?.otherUsers;
  if (Array.isArray(fromCard)) return fromCard;
  return [];
}

// If Soteria, mirror the computed split flag into soteriaPayload.split as "true"/"false"
function withSoteriaSplitFlag(req: UnifiedCommerceRequest, isSplitFlow: boolean): UnifiedCommerceRequest {
  const anyReq: any = req;
  if (anyReq?.type !== "SOTERIA_PAYMENT") return anyReq;
  const payload = { ...(anyReq.soteriaPayload ?? {}), split: isSplitFlow ? "true" : "false" };
  return { ...anyReq, soteriaPayload: payload } as UnifiedCommerceRequest;
}

/* -------------------- Patch SPLIT supercharges only -------------------- */
// Canonical write: root (and mirror under `plan` if present). Never under `card`.
function withSplitSupersOnly(
  req: UnifiedCommerceRequest,
  splitSupers: { amount: number; paymentMethodId: string }[]
): UnifiedCommerceRequest {
  const anyReq: any = req;
  if (anyReq?.plan) {
    return {
      ...anyReq,
      plan: { ...anyReq.plan, splitSuperchargeDetails: splitSupers },
      splitSuperchargeDetails: splitSupers,
    };
  }
  return { ...anyReq, splitSuperchargeDetails: splitSupers };
}

/* -------------------- Component -------------------- */

const UnifiedPayCustomizeScreen: React.FC = () => {
  const navigate = useNavigate();
  const { search } = useLocation();

  // Read payload from ?data=… or sessionStorage (set by other pages)
  const [payload, setPayload] = useState<UnifiedCommerceRequest | null>(null);
  useEffect(() => {
    // compute qs INSIDE the effect and depend on the stable 'search' string
    const qs = new URLSearchParams(search);
    const rawQS = qs.get("data");
    if (rawQS) {
      try {
        setPayload(JSON.parse(rawQS));
        return;
      } catch {
        toast.error("Invalid customize payload.");
      }
    }
    const rawSS = typeof window !== "undefined" ? sessionStorage.getItem("unified_customize_payload") : null;
    if (rawSS) {
      try {
        setPayload(JSON.parse(rawSS));
      } catch {
        toast.error("Invalid stored customize payload.");
      }
    }
  }, [search]); // ✅ fixed (no new object every render)

  // User + payment methods
  const { data: userDetails } = useUserDetails();
  const userId: string | undefined = userDetails?.data?.user?.id;

  const {
    data: methods = [],
    isLoading: methodsLoading,
    isError: methodsError,
  } = usePaymentMethods(userId);

  // Which methods are selectable? For virtual cards, cards only; otherwise all.
  const selectableMethods: PaymentMethod[] = useMemo(() => {
    const all = (methods as PaymentMethod[]) || [];
    if (!payload?.type) return all;
    if (payload.type === "VIRTUAL_CARD") {
      return all.filter((m) => m.type === "card");
    }
    return all;
  }, [methods, payload?.type]);

  // Resolve the best object to display (full method if available, else the stored stub/null).
  const resolveDisplayMethod = useCallback(
    (sel: Field["selectedMethod"]) => {
      if (!sel) return null;
      const full = (methods as PaymentMethod[]).find((m) => m.id === (sel as any).id);
      return (full ?? null) as PaymentMethod | null;
    },
    [methods]
  );

  // Fields (seed from existing split supers if any)
  const [fields, setFields] = useState<Field[]>([]);
  useEffect(() => {
    if (!payload) return;
    if (fields.length) return;

    const existing = getExistingSplitSupers(payload);
    const defaultMethod =
      selectableMethods.find((m) => m.type === "card" && (m as any).card?.primary === true) ||
      selectableMethods[0] ||
      null;

    if (existing.length > 0) {
      const seeded: Field[] = existing.map((d, i) => {
        const local = (methods as PaymentMethod[]).find((m) => m.id === d.paymentMethodId) ?? null;
        return {
          id: `${Date.now()}_${i}`,
          label: `Supercharge #${i + 1}`,
          value: d.amount ? String(d.amount) : "",
          // store FULL method when available; otherwise a stub to preserve id
          selectedMethod: (local ?? makeMethodStub(String(d.paymentMethodId || ""))) as any,
          error: "",
        };
      });
      setFields(seeded);
    } else {
      setFields([
        {
          id: `${Date.now()}`,
          label: "Supercharge #1",
          value: "",
          selectedMethod: defaultMethod ? (defaultMethod as any) : null,
          error: "",
        },
      ]);
    }
  }, [payload, methods, selectableMethods, fields.length]);

  // ⭐ Backfill: once selectable methods are available, ensure any null selectedMethod (esp. first row) gets a default
  useEffect(() => {
    if (!fields.length || !selectableMethods.length) return;

    // quick check: if no field is missing selectedMethod, do nothing (prevents extra setState)
    const hasMissing = fields.some((f) => !f.selectedMethod);
    if (!hasMissing) return;

    const defaultMethod =
      selectableMethods.find((m) => (m as any).card?.primary === true) ||
      selectableMethods[0] ||
      null;
    if (!defaultMethod) return;

    const next = fields.map((f) => (f.selectedMethod ? f : { ...f, selectedMethod: defaultMethod as any }));
    setFields(next);
  }, [selectableMethods, fields]);

  // Amount to match (first-due preferred; else explicit soteria total)
  const dueAmountFromPlan = useMemo(() => getFirstDueAmount(payload), [payload]);
  const soteriaExplicit = useMemo(() => getSoteriaExplicitTotal(payload), [payload]);
  const dueAmount = useMemo(
    () => (dueAmountFromPlan > 0 ? dueAmountFromPlan : soteriaExplicit),
    [dueAmountFromPlan, soteriaExplicit]
  );
  const mustMatchDue = useMemo(() => dueAmount > 0, [dueAmount]);

  const sumFields = useMemo(
    () => fields.reduce((sum, f) => sum + (Number(f.value) || 0), 0),
    [fields]
  );

  // Compute split by examining otherUsers in payload, excluding the current user (if known)
  const otherUsersAll = useMemo(() => getOtherUsers(payload), [payload]);
  const otherUsersExcludingSelf = useMemo(() => {
    if (!userId) return otherUsersAll;
    return otherUsersAll.filter((u) => String(u.userId) !== String(userId));
  }, [otherUsersAll, userId]);
  const isSplitFlow = otherUsersExcludingSelf.length > 0;

  // Add row (moved button to CTA row; handler unchanged)
  const handleAdd = useCallback(() => {
    const def =
      selectableMethods.find((m) => (m as any).card?.primary === true) ||
      selectableMethods[0] ||
      null;
    setFields((prev) => [
      ...prev,
      {
        id: `${Date.now()}`,
        label: `Supercharge #${prev.length + 1}`,
        value: "",
        selectedMethod: def ? (def as any) : null,
        error: "",
      },
    ]);
  }, [selectableMethods]);

  // Picker modal state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // Submit
  const { mutate: runUnified, isPending } = useUnifiedCommerce();

  const onSubmit = useCallback(() => {
    if (!payload) {
      toast.error("Missing payload.");
      return;
    }

    let ok = true;
    setFields((curr) =>
      curr.map((f) => {
        let error = "";
        const num = Number(f.value);
        if (!f.selectedMethod || !(f as any).selectedMethod?.id) {
          error = "Select a payment method";
          ok = false;
        } else if (!f.value || isNaN(num) || num <= 0) {
          error = "Enter a valid amount";
          ok = false;
        } else if (num < 0.5) {
          error = "Minimum is $0.50";
          ok = false;
        }
        return { ...f, error };
      })
    );
    if (!ok) return;

    if (mustMatchDue && !nearlyEqual(sumFields, dueAmount)) {
      toast.error(`Supercharges must total $${dueAmount.toFixed(2)}.`);
      return;
    }

    const splitSuperchargeDetails = fields.map((f) => ({
      paymentMethodId: (f.selectedMethod as any).id,
      amount: Number(f.value),
    }));

    let updated = withSplitSupersOnly(payload, splitSuperchargeDetails);
    updated = withDiscountIdsForwarded(updated);
    // If it's a Soteria op, stamp the split flag computed from otherUsers (excluding self)
    updated = withSoteriaSplitFlag(updated, isSplitFlow);

    runUnified(updated, {
      onSuccess: (res: UnifiedCommerceResponse) => {
        const t = (updated as any)?.type as UnifiedOperationType | undefined;

        let amount = dueAmount || 0;

        // Prefer operation-specific amounts when present
        if (t === "SEND") {
          const s: any = (res as any)?.send ?? (res as any)?.transfer;
          const fromRes =
            toNumberFromMoneyLike(s?.amount) ||
            toNumberFromMoneyLike(s?.transferredAmount) ||
            toNumberFromMoneyLike(s?.totalAmount);
          if (fromRes > 0) amount = fromRes;
        } else if (t === "SOTERIA_PAYMENT") {
          const s: any = (res as any)?.soteriaPayment;
          const fromRes =
            toNumberFromMoneyLike(s?.totalAmount) ||
            toNumberFromMoneyLike(s?.soteriaPaymentTotalAmount);
          if (fromRes > 0) amount = fromRes;
        } else if (t === "CHECKOUT" || t === "PAYMENT" || t === "VIRTUAL_CARD" || t === "ACCEPT_REQUEST" || t === "ACCEPT_SPLIT_REQUEST") {
          // If backend returned a clear total, prefer it
          const r: any = (res as any);
          const guess =
            toNumberFromMoneyLike(r?.totalAmount) ||
            toNumberFromMoneyLike(r?.amount) ||
            toNumberFromMoneyLike(r?.payment?.amount) ||
            0;
          if (guess > 0) amount = guess;
        }

        const token =
          (res as any)?.checkout?.checkoutToken ||
          (res as any)?.checkout?.token ||
          (res as any)?.token ||
          "";

        const qAmount = encodeURIComponent(String(amount.toFixed ? amount.toFixed(2) : amount));
        const qToken = token ? `&checkoutToken=${encodeURIComponent(String(token))}` : "";
        const qSplit = `&split=${isSplitFlow ? "true" : "false"}`;

        // ✅ Navigate to SuccessPayment with the exact params it expects + split flag
        navigate(`/SuccessPayment?amount=${qAmount}${qToken}${qSplit}&replace_to_index=1`);
      },
      onError: (e: unknown) => {
        toast.error(String((e as Error)?.message || "Request failed"));
      },
    });
  }, [payload, fields, mustMatchDue, sumFields, dueAmount, runUnified, navigate, isSplitFlow]);

  // UI state
  const headerTitle = titleByType(payload?.type);
  const disabled =
    isPending ||
    fields.some((f) => !f.value.trim() || !f.selectedMethod) ||
    (mustMatchDue && !nearlyEqual(sumFields, dueAmount));

  // Loading / error states
  if (methodsLoading || !payload || fields.length === 0) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <div
          className="w-10 h-10 rounded-full border-4 border-gray-300 animate-spin"
          style={{ borderTopColor: "#000" }}
        />
        <p className="mt-3 text-sm text-gray-700">Loading…</p>
      </div>
    );
  }
  if (methodsError) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-red-600 font-semibold">Failed to load payment methods.</p>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-white">
        {/* Header: match UnifiedPlans / UnifiedAmountCustomization */}
        <header className="flex items-center p-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-gray-700 hover:text-gray-900"
            aria-label="Back"
            data-testid="back-button"
            type="button"
          >
            <IoIosArrowBack className="mr-2" size={24} /> Back
          </button>
        </header>

        {/* Body */}
        <div className="px-6 mt-2">
          <h1 className="text-2xl font-bold mb-4">{headerTitle}</h1>

          {/* Guidance */}
          <p className="text-sm text-gray-700 mb-4">
            {mustMatchDue ? (
              <>
                Distribute exactly <span className="font-bold">${dueAmount.toFixed(2)}</span> across your
                payment methods.
              </>
            ) : (
              <>Add optional supercharges to split your payment across methods.</>
            )}
          </p>

          {/* Fields */}
          <div className="space-y-4 mb-6">
            {fields.map((f, idx) => {
              const displayMethod = resolveDisplayMethod(f.selectedMethod);
              return (
                <div key={f.id} className="flex flex-col">
                  <FloatingLabelInputOverdraft
                    label={f.label}
                    value={f.value}
                    onChangeText={(txt) =>
                      setFields((curr) =>
                        curr.map((x) => (x.id === f.id ? { ...x, value: txt, error: "" } : x))
                      )
                    }
                    keyboardType="number"
                    selectedMethod={displayMethod as any}
                    onPaymentMethodPress={() => {
                      if (!selectableMethods.length) return;
                      setActiveIndex(idx);
                      setPickerOpen(true);
                    }}
                    error={f.error}
                  />
                  {!!f.error && <p className="text-red-600 text-sm mt-2">* {f.error}</p>}
                </div>
              );
            })}
          </div>

          {/* Totals */}
          <div className="mb-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Supercharges total</span>
              <span className="font-bold">${sumFields.toFixed(2)}</span>
            </div>
            {mustMatchDue && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Required total</span>
                <span className="font-bold">${dueAmount.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* CTA row: Add Supercharge + Complete on the same line with SAME WIDTH */}
          <div className="mt-2">
            <div className="flex items-center gap-3">
              <button
                onClick={handleAdd}
                className="flex-1 px-4 py-3 rounded-lg font-bold bg-white text-black border border-[#ccc]"
                type="button"
              >
                Add Supercharge
              </button>

              <button
                onClick={onSubmit}
                disabled={disabled}
                className={`flex-1 py-3 rounded-lg font-bold text-white ${
                  disabled ? "bg-gray-400 cursor-not-allowed" : "bg-black hover:bg-gray-800"
                }`}
              >
                {isPending ? "Submitting…" : "Complete"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Payment method picker modal (Framer Motion) */}
      <AnimatePresence>
        {pickerOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/60 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setPickerOpen(false)}
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
                  <button onClick={() => setPickerOpen(false)} className="px-3 py-1 rounded bg-black text-white">
                    Close
                  </button>
                </div>

                <div className="p-4 space-y-4">
                  {selectableMethods.length === 0 && (
                    <p className="text-center text-gray-600">No payment methods available.</p>
                  )}

                  {selectableMethods.map((method, idx, arr) => (
                    <PaymentMethodItem
                      key={method.id}
                      method={method}
                      selectedMethod={
                        activeIndex != null
                          ? (resolveDisplayMethod(fields[activeIndex]?.selectedMethod) as any)
                          : ({} as PaymentMethod)
                      }
                      onSelect={(m) => {
                        if (activeIndex != null && activeIndex >= 0) {
                          setFields((curr) => {
                            const copy = [...curr];
                            const target = copy[activeIndex];
                            if (target) {
                              // Store FULL method when user picks from the list
                              copy[activeIndex] = { ...target, selectedMethod: m as any, error: "" };
                            }
                            return copy;
                          });
                        }
                        setPickerOpen(false);
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

      <Toaster richColors position="top-right" />
    </>
  );
};

export default UnifiedPayCustomizeScreen;
