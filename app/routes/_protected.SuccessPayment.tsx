// File: app/routes/SuccessPayment.tsx
import React, { useEffect, useMemo, useCallback } from "react";
import { useLocation, useNavigate } from "@remix-run/react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Web version of SuccessPayment screen
 * - Replaces React Native + Reanimated with HTML/CSS + framer-motion
 * - Uses Remix navigation + URLSearchParams
 * - Auto-dismisses after a short delay (customizable via ?ms=)
 */

const GREEN = "#22c55e";
const BG = "#ffffff";
const TEXT = "#0f172a";
const SUBTLE = "#64748b";
const BORDER = "#e5e7eb";
const LIGHT_CIRCLE = "#F2F3F5";

export default function SuccessPayment() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const qs = new URLSearchParams(search);
  const prefersReducedMotion = useReducedMotion();

  // ----- params -----
  const amountParam = qs.get("amount") || "";
  const checkoutToken = qs.get("checkoutToken") || "";
  const replaceToIndexParam = qs.get("replace_to_index");
  const msParam = qs.get("ms"); // optional: override auto-dismiss (in ms)

  const shouldReplaceToIndex = useMemo(() => {
    const val = String(replaceToIndexParam ?? "").trim().toLowerCase();
    return ["1", "true", "yes", "y", "on"].includes(val);
  }, [replaceToIndexParam]);

  const dismissAfterMs = useMemo(() => {
    const n = parseInt(String(msParam ?? ""), 10);
    // Default 2000ms; clamp to [800, 10000] for sanity
    if (Number.isFinite(n)) return Math.min(10000, Math.max(800, n));
    return 2000;
  }, [msParam]);

  const amountNumber = useMemo(() => {
    const n = parseFloat(amountParam);
    return Number.isFinite(n) ? n : 0;
  }, [amountParam]);

  const amountText = `$${amountNumber.toFixed(2)}`;

  // Unified exit behavior
  const exitScreen = useCallback(() => {
    if (shouldReplaceToIndex) {
      // Replace to app root (tabs-equivalent)
      navigate("/", { replace: true });
    } else {
      // Try to go back; if not possible, go home
      window.history.length > 1 ? navigate(-1) : navigate("/", { replace: true });
    }
  }, [navigate, shouldReplaceToIndex]);

  // Auto-dismiss after delay
  useEffect(() => {
    const t = setTimeout(exitScreen, dismissAfterMs);
    return () => clearTimeout(t);
  }, [exitScreen, dismissAfterMs]);

  // Update document title for a11y / clarity
  useEffect(() => {
    const prev = document.title;
    document.title = "Payment Successful";
    return () => {
      document.title = prev;
    };
  }, []);

  // Keyboard shortcuts: Esc or Enter closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") {
        exitScreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exitScreen]);

  // Animation configs (respect reduced motion)
  const rippleA = prefersReducedMotion
    ? {}
    : { initial: { scale: 0.8, opacity: 0.18 }, animate: { scale: 1.9, opacity: 0 } };

  const rippleB = prefersReducedMotion
    ? {}
    : {
        initial: { scale: 0.8, opacity: 0.14 },
        animate: { scale: 2.3, opacity: 0 },
        transition: { duration: 1.0, ease: "easeOut", delay: 0.12 },
      };

  const burst = (x: number, y: number, delay: number) =>
    prefersReducedMotion
      ? {}
      : {
          initial: { scale: 0.2, opacity: 0.9, x, y },
          animate: { scale: 1.2, opacity: 0, x, y },
          transition: { duration: 0.7, ease: "easeOut", delay },
        };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG,
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}
      aria-live="polite"
      role="status"
    >
      {/* Close button */}
      <button
        aria-label="Close"
        onClick={exitScreen}
        style={{
          position: "absolute",
          right: 16,
          top: 12,
          width: 36,
          height: 36,
          borderRadius: 18,
          background: LIGHT_CIRCLE,
          display: "grid",
          placeItems: "center",
          zIndex: 20,
          boxShadow: "0 3px 6px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.06)",
          border: "none",
          cursor: "pointer",
        }}
      >
        {/* X icon */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M6 6l12 12M18 6L6 18"
            stroke="#111827"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {/* Hero */}
      <div
        style={{
          flex: 1,
          display: "grid",
          placeItems: "center",
          padding: 24,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 220,
              height: 220,
              position: "relative",
              margin: "0 auto 18px",
            }}
          >
            {/* Ripples */}
            <motion.div
              {...rippleA}
              transition={{ duration: 0.9, ease: "easeOut" }}
              style={{
                position: "absolute",
                inset: "10px",
                borderRadius: "9999px",
                background: GREEN,
              }}
            />
            <motion.div
              {...rippleB}
              style={{
                position: "absolute",
                inset: "10px",
                borderRadius: "9999px",
                background: GREEN,
              }}
            />

            {/* Bursts */}
            <motion.div
              {...burst(92, -10, 0.12)}
              style={{
                position: "absolute",
                width: 12,
                height: 12,
                borderRadius: 6,
                background: GREEN,
              }}
            />
            <motion.div
              {...burst(-78, 6, 0.18)}
              style={{
                position: "absolute",
                width: 12,
                height: 12,
                borderRadius: 6,
                background: GREEN,
              }}
            />
            <motion.div
              {...burst(10, -88, 0.24)}
              style={{
                position: "absolute",
                width: 12,
                height: 12,
                borderRadius: 6,
                background: GREEN,
              }}
            />

            {/* Main circle */}
            <motion.div
              initial={prefersReducedMotion ? {} : { scale: 0.7, opacity: 0 }}
              animate={prefersReducedMotion ? {} : { scale: 1, opacity: 1 }}
              transition={prefersReducedMotion ? {} : { type: "spring", damping: 10, stiffness: 160 }}
              style={{
                width: 180,
                height: 180,
                borderRadius: 90,
                background: GREEN,
                display: "grid",
                placeItems: "center",
                margin: "0 auto",
                boxShadow: `0 8px 18px rgba(34,197,94,0.35)`,
              }}
            >
              {/* Checkmark */}
              <motion.div
                initial={prefersReducedMotion ? {} : { scale: 0, opacity: 0 }}
                animate={prefersReducedMotion ? {} : { scale: 1, opacity: 1 }}
                transition={
                  prefersReducedMotion ? {} : { type: "spring", damping: 10, stiffness: 220, delay: 0.12 }
                }
                style={{ display: "grid", placeItems: "center" }}
              >
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M20 6L9 17l-5-5"
                    stroke="#fff"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </motion.div>
            </motion.div>
          </div>

          {/* Texts */}
          <motion.h1
            initial={prefersReducedMotion ? {} : { y: 14, opacity: 0 }}
            animate={prefersReducedMotion ? {} : { y: 0, opacity: 1 }}
            transition={{ duration: 0.26, delay: 0.16 }}
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: TEXT,
              margin: "6px 0",
            }}
          >
            Payment Successful
          </motion.h1>

          <motion.p
            initial={prefersReducedMotion ? {} : { y: 14, opacity: 0 }}
            animate={prefersReducedMotion ? {} : { y: 0, opacity: 1 }}
            transition={{ duration: 0.26, delay: 0.3 }}
            style={{
              fontSize: 16,
              color: SUBTLE,
              marginBottom: 12,
            }}
          >
            You’ve completed a payment of{" "}
            <span style={{ color: TEXT, fontWeight: 700 }}>{amountText}</span>.
          </motion.p>

          {/* Optional token */}
          {checkoutToken ? (
            <motion.div
              initial={prefersReducedMotion ? {} : { y: 14, opacity: 0 }}
              animate={prefersReducedMotion ? {} : { y: 0, opacity: 1 }}
              transition={{ duration: 0.26, delay: 0.46 }}
              style={{
                background: "#f8fafc",
                border: `1px solid ${BORDER}`,
                borderRadius: 12,
                padding: "10px 12px",
                marginTop: 2,
                maxWidth: 420,
                marginInline: "auto",
              }}
            >
              <div
                style={{
                  color: SUBTLE,
                  fontSize: 12,
                  marginBottom: 2,
                  textAlign: "center",
                }}
              >
                Checkout Token
              </div>
              <div
                title={checkoutToken}
                style={{
                  color: TEXT,
                  fontSize: 14,
                  textAlign: "center",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                }}
              >
                {checkoutToken}
              </div>
            </motion.div>
          ) : null}
        </div>
      </div>

      {/* Footer spacer */}
      <div style={{ height: "12vh" }} />
    </div>
  );
}
