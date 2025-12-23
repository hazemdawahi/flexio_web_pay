import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { motion, useReducedMotion } from "framer-motion";

// SPA mode clientLoader - enables route module optimization
export const clientLoader = async () => null;

/**
 * SuccessMonitor
 * ----------------
 * Shows SUCCESS/FAIL animation first, waits (?ms=, default 1200ms),
 * THEN posts the terminal event to the host and exits.
 *
 * Query params:
 *   - ms: number            Auto-dismiss delay after terminal status (default 1200ms, clamp [300..10000])
 *   - ready: 1|true         Post a MONITORING_READY handshake on mount (NO __PAYMENT_EVENT flag)
 *   - origin: string        Target origin for postMessage (default "*")
 *   - replace_to_index: 1|true   Standalone tab fallback goes to "/"
 *   - status: COMPLETED|FAILED   (optional) drive terminal state via URL
 */

const GREEN = "#22c55e";
const RED = "#ef4444";
const BG = "#ffffff";
const TEXT = "#0f172a";
const SUBTLE = "#64748b";
const LIGHT = "#F2F3F5";
const BORDER = "#e5e7eb";

type Terminal = "COMPLETED" | "FAILED";

export default function SuccessMonitor() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const qs = useMemo(() => new URLSearchParams(search), [search]);
  const prefersReducedMotion = useReducedMotion();

  // ----- params -----
  const msParam = qs.get("ms");
  const originParam = qs.get("origin") || "*";
  const readyParam = qs.get("ready");
  const replaceToIndexParam = qs.get("replace_to_index");
  const statusParam = qs.get("status"); // allow URL-driven terminal status

  const dismissAfterMs = useMemo(() => {
    const n = parseInt(String(msParam ?? ""), 10);
    if (Number.isFinite(n)) return Math.min(10000, Math.max(300, n));
    return 1200;
  }, [msParam]);

  const postReady = useMemo(() => {
    const v = String(readyParam ?? "").trim().toLowerCase();
    return ["1", "true", "yes", "y", "on"].includes(v);
  }, [readyParam]);

  const shouldReplaceToIndex = useMemo(() => {
    const v = String(replaceToIndexParam ?? "").trim().toLowerCase();
    return ["1", "true", "yes", "y", "on"].includes(v);
  }, [replaceToIndexParam]);

  // ----- env helpers -----
  const isInPopup = () => !!window.opener;
  const isInIframe = () => window.parent && window.parent !== window;
  const getTargets = () => {
    const arr: Window[] = [];
    if (window.opener) arr.push(window.opener as Window);
    if (window.parent && window.parent !== window) arr.push(window.parent);
    if (arr.length === 0) arr.push(window);
    return arr;
  };

  // ----- state -----
  const [phase, setPhase] = useState<"listening" | "done">("listening");
  const [result, setResult] = useState<Terminal | null>(null);
  const hasBroadcastRef = useRef(false);
  const waitTimerRef = useRef<number | null>(null);

  // Normalize any inbound message into a terminal status if applicable
  const interpretStatus = (data: any): Terminal | null => {
    if (!data || typeof data !== "object") return null;

    const s = String(data.status ?? "").toUpperCase();
    if (s === "COMPLETED") return "COMPLETED";
    if (s === "FAILED") return "FAILED";

    const ev = String(data.event ?? "").toLowerCase();
    if (ev === "complete") return "COMPLETED";

    const t = String(data.type ?? "").toUpperCase();
    if (t === "PAYMENT_COMPLETED") return "COMPLETED";
    if (t === "PAYMENT_FAILED") return "FAILED";

    return null;
    // NOTE: We intentionally ignore SPLIT_REQUEST here; monitoring’s terminal is success/fail only.
  };

  // Broadcast to host (opener/parent)
  const broadcastToHost = useCallback(
    (status: Terminal) => {
      if (hasBroadcastRef.current) return;
      hasBroadcastRef.current = true;

      const payload = {
        __PAYMENT_EVENT: true, // mark as a payment/monitoring event for the bridge
        status,
        source: "SuccessMonitor",
        timestamp: new Date().toISOString(),
        // Monitoring emits terminal state only; split is not meaningful here, default false
        split: false,
      };

      for (const target of getTargets()) {
        try {
          target.postMessage(payload, originParam);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn("[SuccessMonitor] postMessage failed:", e);
        }
      }
    },
    [originParam]
  );

  // Exit flow (no built-in delay here; we delay BEFORE calling this)
  const exitNow = useCallback(() => {
    if (isInPopup()) {
      window.close();
      return;
    }
    if (isInIframe()) {
      // Host overlay should close itself on receiving our broadcast.
      return;
    }
    if (shouldReplaceToIndex) {
      navigate("/", { replace: true });
    } else {
      window.history.length > 1 ? navigate(-1) : navigate("/", { replace: true });
    }
  }, [navigate, shouldReplaceToIndex]);

  // Shared routine: when we have a terminal status, show animation, wait, then broadcast+exit
  const handleTerminal = useCallback(
    (terminal: Terminal) => {
      setResult(terminal);
      setPhase("done");

      if (waitTimerRef.current) {
        clearTimeout(waitTimerRef.current);
        waitTimerRef.current = null;
      }

      waitTimerRef.current = window.setTimeout(() => {
        broadcastToHost(terminal);
        exitNow();
      }, Math.max(0, dismissAfterMs));
    },
    [broadcastToHost, dismissAfterMs, exitNow]
  );

  // A) Accept terminal status via postMessage (host-driven)
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const terminal = interpretStatus(event.data);
      if (!terminal) return;
      handleTerminal(terminal);
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      if (waitTimerRef.current) {
        clearTimeout(waitTimerRef.current);
        waitTimerRef.current = null;
      }
    };
  }, [handleTerminal]);

  // B) Accept terminal via URL (?status=COMPLETED|FAILED) — page-driven (e.g., after navigate)
  useEffect(() => {
    const v = (statusParam || "").trim().toUpperCase();
    if (v === "COMPLETED" || v === "FAILED") {
      handleTerminal(v as Terminal);
    }
  }, [statusParam, handleTerminal]);

  // Optional handshake: announce that we're listening (NO __PAYMENT_EVENT flag)
  useEffect(() => {
    if (!postReady) return;
    const readyPayload = { status: "MONITORING_READY", source: "SuccessMonitor" };
    for (const target of getTargets()) {
      try {
        target.postMessage(readyPayload, originParam);
      } catch (e) {
        console.warn("[SuccessMonitor] ready postMessage failed:", e);
      }
    }
  }, [postReady, originParam]);

  // Keyboard shortcut: Esc closes immediately (rebroadcast if we already have a result)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (result) broadcastToHost(result);
      exitNow();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [broadcastToHost, exitNow, result]);

  // Visual motion presets
  const checkMotion = prefersReducedMotion
    ? {}
    : { initial: { scale: 0.7, opacity: 0 }, animate: { scale: 1, opacity: 1 } };

  const ringMotion = prefersReducedMotion
    ? {}
    : { initial: { opacity: 0.15, scale: 0.9 }, animate: { opacity: 0, scale: 1.6 } };

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
        onClick={() => {
          if (result) broadcastToHost(result);
          exitNow();
        }}
        style={{
          position: "absolute",
          right: 16,
          top: 12,
          width: 36,
          height: 36,
          borderRadius: 18,
          background: LIGHT,
          display: "grid",
          placeItems: "center",
          zIndex: 20,
          boxShadow: "0 3px 6px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.06)",
          border: "none",
          cursor: "pointer",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" stroke="#111827" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {/* Body */}
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
              width: 200,
              height: 200,
              position: "relative",
              margin: "0 auto 18px",
            }}
          >
            {/* Soft ring */}
            <motion.div
              {...ringMotion}
              transition={{ duration: 1.0, ease: "easeOut" }}
              style={{
                position: "absolute",
                inset: "14px",
                borderRadius: "9999px",
                background: result === "FAILED" ? RED : GREEN,
              }}
              key={result || "listening-ring"}
            />

            {/* Main circle */}
            <motion.div
              {...checkMotion}
              transition={prefersReducedMotion ? {} : { type: "spring", damping: 12, stiffness: 180 }}
              style={{
                width: 160,
                height: 160,
                borderRadius: 80,
                background: result === "FAILED" ? RED : GREEN,
                display: "grid",
                placeItems: "center",
                margin: "0 auto",
                boxShadow:
                  result === "FAILED"
                    ? "0 8px 18px rgba(239,68,68,0.35)"
                    : "0 8px 18px rgba(34,197,94,0.35)",
              }}
              key={result || "listening-core"}
            >
              {phase === "listening" ? (
                // Dots while waiting
                <div style={{ display: "flex", gap: 6 }}>
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      initial={{ opacity: 0.4, y: 0 }}
                      animate={{ opacity: 1, y: -6 }}
                      transition={{
                        repeat: Infinity,
                        repeatType: "reverse",
                        duration: 0.6,
                        delay: i * 0.12,
                      }}
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        background: "#fff",
                        display: "inline-block",
                      }}
                    />
                  ))}
                </div>
              ) : result === "FAILED" ? (
                // X icon
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M15 9L9 15M9 9l6 6"
                    stroke="#fff"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                // Check icon
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M20 6L9 17l-5-5"
                    stroke="#fff"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </motion.div>
          </div>

          {/* Title */}
          <motion.h1
            initial={prefersReducedMotion ? {} : { y: 12, opacity: 0 }}
            animate={prefersReducedMotion ? {} : { y: 0, opacity: 1 }}
            transition={{ duration: 0.26, delay: 0.12 }}
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: TEXT,
              margin: "6px 0",
            }}
          >
            {phase === "listening"
              ? "Waiting for completion…"
              : result === "FAILED"
              ? "Monitor Failed"
              : "Monitor Successful"}
          </motion.h1>

          {/* Subtext */}
          <motion.p
            initial={prefersReducedMotion ? {} : { y: 12, opacity: 0 }}
            animate={prefersReducedMotion ? {} : { y: 0, opacity: 1 }}
            transition={{ duration: 0.26, delay: 0.24 }}
            style={{
              fontSize: 15,
              color: SUBTLE,
              marginBottom: 4,
            }}
          >
            {phase === "listening"
              ? "This page will close automatically after we receive the final status."
              : "You can close this window now."}
          </motion.p>
        </div>
      </div>

      {/* Footer spacer */}
      <div style={{ height: "12vh", borderTop: `1px solid ${BORDER}`, background: "#fafafa" }} />
    </div>
  );
}
